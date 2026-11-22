import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Scene3DErrorBoundary } from './Scene3DErrorBoundary';
import { GlbArtifactCanvas } from './GlbArtifactCanvas';
import type { GlbCacheAdapter } from './glbCache';
import type { PublicModel } from './glbSchema';
import {
  GlbLoadError,
  loadGlbModel,
  type LoadedGlbAsset,
  type LoadGlbOptions,
} from './glbLoader';
import { disposeModel } from './glbValidation';

export interface GlbArtifactViewProps {
  title: string;
  model: PublicModel;
  apiBaseUrl?: string;
  cache?: GlbCacheAdapter;
  fetchImpl?: LoadGlbOptions['fetchImpl'];
  sha256Impl?: LoadGlbOptions['sha256Impl'];
  onLoaded?: (asset: LoadedGlbAsset) => void;
  onFallback2D?: () => void;
}

type ViewState =
  | { status: 'loading'; progress: number }
  | { status: 'ready'; asset: LoadedGlbAsset }
  | { status: 'error'; message: string; category: string; retryAfterSeconds?: number };

/**
 * Màn hình hiển thị 1 hiện vật GLB tải qua API và bộ nhớ đệm cục bộ (MOB-E6-02).
 * Quản lý hủy request khi rời màn, giải phóng GPU `disposeModel` và fallback 2D khi lỗi.
 */
export function GlbArtifactView({
  title,
  model,
  apiBaseUrl,
  cache,
  fetchImpl,
  sha256Impl,
  onLoaded,
  onFallback2D,
}: GlbArtifactViewProps) {
  const theme = useTheme();
  const [state, setState] = useState<ViewState>({ status: 'loading', progress: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let mountedAsset: LoadedGlbAsset | null = null;
    let cancelled = false;

    setState({ status: 'loading', progress: 0 });

    loadGlbModel({
      model,
      apiBaseUrl,
      cache,
      fetchImpl,
      sha256Impl,
      signal: controller.signal,
      onProgress: (ratio) => {
        if (!cancelled) {
          setState((prev) => (prev.status === 'loading' ? { status: 'loading', progress: ratio } : prev));
        }
      },
    })
      .then((asset) => {
        if (cancelled) {
          disposeModel(asset.scenes);
          return;
        }
        mountedAsset = asset;
        setState({ status: 'ready', asset });
        onLoaded?.(asset);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof GlbLoadError) {
          setState({
            status: 'error',
            message: error.message,
            category: error.category,
            retryAfterSeconds: error.retryAfterSeconds,
          });
          return;
        }
        setState({
          status: 'error',
          message: 'Không thể hiển thị mô hình 3D.',
          category: 'unknown',
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (mountedAsset) {
        disposeModel(mountedAsset.scenes);
        mountedAsset = null;
      }
    };
  }, [model, apiBaseUrl, cache, fetchImpl, sha256Impl, onLoaded, attempt]);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.metaBar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
          },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.md }]}
        >
          {title}
        </Text>
        {state.status === 'ready' ? (
          <Text
            testID="glb-source-badge"
            style={{ color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '600' }}
          >
            {state.asset.source === 'cache' ? 'Nguồn: Bộ nhớ đệm cục bộ' : 'Nguồn: Tải từ máy chủ'} ·{' '}
            {(state.asset.sizeBytes / 1024).toFixed(1)} KB · {state.asset.loadDurationMs} ms
          </Text>
        ) : state.status === 'loading' ? (
          <Text
            testID="glb-loading-label"
            style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}
          >
            Đang tải mô hình 3D ({Math.round(state.progress * 100)}%)...
          </Text>
        ) : (
          <Text
            testID="glb-error-category"
            style={{ color: theme.colors.danger, fontSize: theme.fontSize.xs }}
          >
            Lỗi tải mô hình ({state.category})
          </Text>
        )}
      </View>

      <View style={[styles.viewport, { borderRadius: theme.radius.lg }]}>
        {state.status === 'loading' ? (
          <View style={styles.centerBox} testID="glb-loading-view">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Đang kiểm tra bộ nhớ đệm và giải mã GLB...</Text>
          </View>
        ) : state.status === 'error' ? (
          <View
            accessible
            accessibilityRole="alert"
            testID="glb-error-view"
            style={styles.centerBox}
          >
            <Text style={styles.errorTitle}>Không thể hiển thị mô hình 3D</Text>
            <Text style={styles.errorMessage}>{state.message}</Text>
            {state.retryAfterSeconds !== undefined ? (
              <Text style={styles.errorHint}>
                Vui lòng thử lại sau khoảng {state.retryAfterSeconds} giây.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thử tải lại mô hình 3D"
                onPress={() => setAttempt((prev) => prev + 1)}
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.actionText}>Thử lại</Text>
              </Pressable>
              {onFallback2D ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem mô tả hiện vật 2D"
                  onPress={onFallback2D}
                  style={[styles.actionButton, styles.secondaryAction]}
                >
                  <Text style={styles.actionText}>Xem bản 2D</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <Scene3DErrorBoundary onFallback2D={onFallback2D}>
            <GlbArtifactCanvas asset={state.asset} />
          </Scene3DErrorBoundary>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  metaBar: { borderWidth: 1, gap: 4 },
  title: { fontWeight: '700' },
  viewport: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: { color: '#E5E7EB', fontSize: 14, textAlign: 'center' },
  errorTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  errorMessage: { color: '#E5E7EB', fontSize: 14, textAlign: 'center' },
  errorHint: { color: '#CCFBF1', fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
