import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#EBF5FF] flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-red-200 p-6 max-w-lg w-full shadow-lg">
            <p className="text-red-500 font-bold text-sm mb-2">Erro ao carregar página</p>
            <pre className="text-red-400 text-xs bg-red-50 rounded-xl p-4 overflow-auto whitespace-pre-wrap">
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack?.slice(0, 600)}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 w-full bg-cobeb-navy text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
