import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { clearLatestFatalError, reportFatalError } from "../lib/appCrashHandler";
import { theme } from "../theme";

type Props = {
  children: React.ReactNode;
  onRetry?: () => void;
};

type State = {
  error: Error | null;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportFatalError(error);
  }

  private handleRetry = () => {
    clearLatestFatalError();
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something Went Wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected problem while loading. Please close and reopen it.
          </Text>
          <Text selectable style={styles.errorText}>
            {this.state.error.message || "Unknown application error"}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    padding: 24
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16
  },
  retryButton: {
    marginTop: 20,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600"
  }
});
