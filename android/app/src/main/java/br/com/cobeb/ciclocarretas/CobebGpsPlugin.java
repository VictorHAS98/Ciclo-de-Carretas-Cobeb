package br.com.cobeb.ciclocarretas;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CobebGps")
public class CobebGpsPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String supabaseUrl  = call.getString("supabaseUrl");
        String supabaseKey  = call.getString("supabaseKey");
        String accessToken  = call.getString("accessToken", "");
        String viagemId     = call.getString("viagemId");

        Intent intent = new Intent(getContext(), CobebGpsService.class);
        intent.putExtra("supabaseUrl",  supabaseUrl);
        intent.putExtra("supabaseKey",  supabaseKey);
        intent.putExtra("accessToken",  accessToken);
        intent.putExtra("viagemId",     viagemId);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void updateToken(PluginCall call) {
        String accessToken = call.getString("accessToken", "");
        getContext()
                .getSharedPreferences(CobebGpsService.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("accessToken", accessToken)
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        getContext().stopService(new Intent(getContext(), CobebGpsService.class));
        getContext()
                .getSharedPreferences(CobebGpsService.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().clear().apply();
        call.resolve();
    }
}
