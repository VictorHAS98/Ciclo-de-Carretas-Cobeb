package br.com.cobeb.ciclocarretas;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import android.util.Base64;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Timer;
import java.util.TimerTask;
import java.util.TimeZone;

/**
 * Serviço nativo de rastreamento GPS — completamente independente do WebView/Capacitor.
 * Funciona com tela apagada, em Doze mode, e reinicia sozinho se morto (START_STICKY).
 */
public class CobebGpsService extends Service {

    private static final String TAG = "CobebGpsService";
    private static final String CHANNEL_ID = "cobeb_gps_channel";
    private static final int NOTIFICATION_ID = 99201;
    static final String PREFS_NAME = "cobeb_gps_prefs";
    private static final long SYNC_INTERVAL_MS = 30_000L;
    private static final long LOCATION_INTERVAL_MS = 10_000L;

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private HandlerThread callbackThread;
    private Timer syncTimer;
    private PowerManager.WakeLock wakeLock;
    private volatile Location lastLocation;

    private String supabaseUrl;
    private String supabaseKey;
    private String accessToken;
    private String refreshToken;
    private String viagemId;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null
                && intent.hasExtra("supabaseUrl")
                && intent.hasExtra("viagemId")) {
            supabaseUrl  = intent.getStringExtra("supabaseUrl");
            supabaseKey  = intent.getStringExtra("supabaseKey");
            accessToken  = intent.getStringExtra("accessToken");
            refreshToken = intent.getStringExtra("refreshToken");
            viagemId     = intent.getStringExtra("viagemId");
            persistPrefs();
        } else {
            // Reiniciado pelo Android (START_STICKY) — restaura das prefs
            restorePrefs();
        }

        if (supabaseUrl == null || viagemId == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        promoteToForeground();
        acquireWakeLock();
        startLocationTracking();
        startSyncTimer();

        Log.i(TAG, "Rastreamento iniciado para viagem " + viagemId);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy");
        cleanup();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Usuário fechou o app explicitamente — limpa prefs e para
        Log.i(TAG, "onTaskRemoved — parando rastreamento");
        clearPrefs();
        cleanup();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    // ── Foreground notification ───────────────────────────────────────────────

    private void promoteToForeground() {
        createNotificationChannel();

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notif;
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        builder.setContentTitle("COBEB Ciclo — Rastreamento ativo")
               .setContentText("COBEB está rastreando sua localização")
               .setSmallIcon(R.mipmap.ic_launcher)
               .setOngoing(true)
               .setPriority(Notification.PRIORITY_LOW)
               .setContentIntent(pi);
        notif = builder.build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notif,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground falhou: " + e.getMessage());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Rastreamento GPS", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("COBEB Ciclo rastreamento de viagem");
            ch.enableLights(false);
            ch.enableVibration(false);
            ch.setSound(null, null);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    // ── WakeLock ─────────────────────────────────────────────────────────────

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK, "CobebCiclo:GpsWakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
            Log.i(TAG, "WakeLock adquirido");
        }
    }

    // ── Location tracking ─────────────────────────────────────────────────────

    private void startLocationTracking() {
        callbackThread = new HandlerThread("CobebGpsThread");
        callbackThread.start();
        Looper looper = callbackThread.getLooper();

        fusedClient = LocationServices.getFusedLocationProviderClient(this);

        LocationRequest request = new LocationRequest.Builder(LOCATION_INTERVAL_MS)
                .setMinUpdateIntervalMillis(5_000L)
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setMinUpdateDistanceMeters(0f)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                Location loc = result.getLastLocation();
                if (loc != null) {
                    lastLocation = loc;
                    syncToSupabase(loc.getLatitude(), loc.getLongitude());
                }
            }
        };

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, looper);
            Log.i(TAG, "FusedLocationProvider registrado");
        } catch (SecurityException e) {
            Log.e(TAG, "Permissão de localização negada: " + e.getMessage());
        }
    }

    // ── Periodic sync timer ───────────────────────────────────────────────────

    private void startSyncTimer() {
        syncTimer = new Timer("CobebSyncTimer", false); // não-daemon: não morre com a main thread
        syncTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                Location loc = lastLocation;
                if (loc != null) {
                    Log.d(TAG, "Timer sync");
                    syncToSupabase(loc.getLatitude(), loc.getLongitude());
                }
            }
        }, SYNC_INTERVAL_MS, SYNC_INTERVAL_MS);
    }

    // ── Token refresh ─────────────────────────────────────────────────────────

    private long getTokenExpiry(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return 0;
            String payload = new String(
                    Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_PADDING),
                    StandardCharsets.UTF_8);
            int idx = payload.indexOf("\"exp\":");
            if (idx < 0) return 0;
            String after = payload.substring(idx + 6).trim();
            int end = 0;
            while (end < after.length() && Character.isDigit(after.charAt(end))) end++;
            return Long.parseLong(after.substring(0, end)) * 1000L;
        } catch (Exception e) {
            return 0;
        }
    }

    private String extractJsonString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int idx = json.indexOf(search);
        if (idx < 0) return null;
        int start = idx + search.length();
        int end   = json.indexOf("\"", start);
        return end < 0 ? null : json.substring(start, end);
    }

    private void refreshTokenIfNeeded() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String curAccess  = prefs.getString("accessToken",  "");
        String curRefresh = prefs.getString("refreshToken", "");
        if (curAccess.isEmpty() || curRefresh.isEmpty() || supabaseUrl == null || supabaseKey == null) return;

        long expiry = getTokenExpiry(curAccess);
        if (expiry == 0) return;
        // Renova se expira em menos de 5 minutos
        if (System.currentTimeMillis() < expiry - 5 * 60 * 1000L) return;

        Log.i(TAG, "Token próximo de expirar — renovando");
        try {
            URL url = new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(15_000);

            String body  = "{\"refresh_token\":\"" + curRefresh + "\"}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = conn.getOutputStream()) { os.write(bytes); }

            int code = conn.getResponseCode();
            if (code == 200) {
                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                }
                String resp        = sb.toString();
                String newAccess   = extractJsonString(resp, "access_token");
                String newRefresh  = extractJsonString(resp, "refresh_token");
                if (newAccess != null && !newAccess.isEmpty()) {
                    prefs.edit()
                            .putString("accessToken",  newAccess)
                            .putString("refreshToken", newRefresh != null ? newRefresh : curRefresh)
                            .apply();
                    accessToken  = newAccess;
                    refreshToken = newRefresh != null ? newRefresh : curRefresh;
                    Log.i(TAG, "Token renovado com sucesso");
                }
            } else {
                Log.w(TAG, "Falha ao renovar token: HTTP " + code);
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao renovar token: " + e.getMessage());
        }
    }

    // ── Supabase HTTP sync ────────────────────────────────────────────────────

    private void syncToSupabase(double lat, double lng) {
        final String url_   = supabaseUrl;
        final String key_   = supabaseKey;
        final String vid_   = viagemId;
        if (url_ == null || key_ == null || vid_ == null) return;

        refreshTokenIfNeeded();

        // Lê accessToken atualizado das prefs (pode ter sido renovado)
        final String token_ = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString("accessToken", key_);
        final String bearer = (token_ != null && !token_.isEmpty()) ? token_ : key_;

        new Thread(() -> {
            try {
                SimpleDateFormat sdf =
                        new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                String ts = sdf.format(new Date());

                URL url = new URL(url_ + "/rest/v1/viagens?id=eq." + vid_);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setRequestProperty("apikey", key_);
                conn.setRequestProperty("Authorization", "Bearer " + bearer);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(15_000);

                String body = String.format(Locale.US,
                        "{\"motorista_lat\":%f,\"motorista_lng\":%f,"
                        + "\"motorista_last_seen_at\":\"%s\"}",
                        lat, lng, ts);
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
                int code = conn.getResponseCode();
                Log.d(TAG, "Sync HTTP " + code + " lat=" + lat + " lng=" + lng);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Sync falhou: " + e.getMessage());
            }
        }).start();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    private void cleanup() {
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
        if (syncTimer != null) { syncTimer.cancel(); syncTimer = null; }
        if (callbackThread != null) { callbackThread.quitSafely(); callbackThread = null; }
        if (wakeLock != null && wakeLock.isHeld()) { wakeLock.release(); wakeLock = null; }
        stopForeground(true);
    }

    // ── SharedPreferences ─────────────────────────────────────────────────────

    private void persistPrefs() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                .putString("supabaseUrl",  supabaseUrl)
                .putString("supabaseKey",  supabaseKey)
                .putString("accessToken",  accessToken  != null ? accessToken  : "")
                .putString("refreshToken", refreshToken != null ? refreshToken : "")
                .putString("viagemId",     viagemId)
                .apply();
    }

    private void restorePrefs() {
        SharedPreferences p = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        supabaseUrl  = p.getString("supabaseUrl",  null);
        supabaseKey  = p.getString("supabaseKey",  null);
        accessToken  = p.getString("accessToken",  null);
        refreshToken = p.getString("refreshToken", null);
        viagemId     = p.getString("viagemId",     null);
        Log.i(TAG, "Restaurado de prefs: viagemId=" + viagemId);
    }

    private void clearPrefs() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().clear().apply();
    }
}
