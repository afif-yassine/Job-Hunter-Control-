"use client";
import { Component, type ReactNode } from "react";

/**
 * A view that crashes shows what broke instead of a blank page; the rest of
 * the dashboard keeps working.
 */
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="callout bad" role="alert">
        <div className="callout-body">
          <strong>Cette page a rencontré une erreur : {this.props.name}</strong>
          <div>{this.state.error.message || "Erreur inconnue"}</div>
          <button className="btn secondary small" style={{ marginTop: 8 }} onClick={() => this.setState({ error: null })}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }
}
