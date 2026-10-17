// Тиждень 5: ErrorBoundary — ловить помилки React і показує зрозумілу сторінку.
// Замість «білого екрану» — показує що сталось і як виправити.

import { Component, type ReactNode } from "react";
import { Button, Result } from "antd";
import { log } from "../lib/logy";

interface Props {
  children: ReactNode;
}

interface State {
  pomylka: Error | null;
  info: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { pomylka: null, info: "" };

  static getDerivedStateFromError(pomylka: Error): Partial<State> {
    return { pomylka };
  }

  componentDidCatch(pomylka: Error, info: React.ErrorInfo) {
    // Логуємо помилку зі стеком
    void log.error("react-error-boundary", pomylka.message, {
      stack: pomylka.stack,
      componentStack: info.componentStack,
    });
    this.setState({ info: info.componentStack ?? "" });
  }

  obnovyty = () => {
    this.setState({ pomylka: null, info: "" });
  };

  render() {
    if (this.state.pomylka) {
      return (
        <Result
          status="error"
          title="Сталася помилка 😕"
          subTitle={this.state.pomylka.message}
          extra={[
            <Button key="obnovyty" type="primary" onClick={this.obnovyty}>
              Спробувати ще раз
            </Button>,
            <Button key="golovna" onClick={() => { window.location.hash = "/"; }}>
              На головну
            </Button>,
          ]}
        >
          <details style={{ marginTop: 16, textAlign: "left", fontSize: 12, color: "#999" }}>
            <summary>Технічні деталі (для розробника)</summary>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {this.state.pomylka.stack}
            </pre>
          </details>
        </Result>
      );
    }

    return this.props.children;
  }
}
