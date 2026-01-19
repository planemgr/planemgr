import type { ChangeEvent } from "react";
import type { Node } from "reactflow";
import type { NodeKind } from "../domain";
import type { PlanNodeData } from "../graph";

type PlatformType = "ssh";

type PlatformConfig = {
  platformType?: PlatformType;
  sshHost?: string;
};

type Props = {
  node: Node<PlanNodeData> | null;
  isEditingLocked: boolean;
  onUpdateLabel: (nodeId: string, nextLabel: string) => void;
  onUpdateConfig: (nodeId: string, nextConfig: Record<string, unknown>) => void;
  onCommitDraft: () => void;
};

const normalizePlatformConfig = (config?: Record<string, unknown>): PlatformConfig => {
  if (!config) {
    return { platformType: "ssh", sshHost: "" };
  }
  const platformType =
    typeof config.platformType === "string" && config.platformType === "ssh" ? "ssh" : "ssh";
  const sshHost = typeof config.sshHost === "string" ? config.sshHost : "";
  return { platformType, sshHost };
};

const normalizeProvider = (config?: Record<string, unknown>) =>
  typeof config?.provider === "string" ? config.provider : "";

const normalizeReplicas = (config?: Record<string, unknown>) => {
  if (typeof config?.replicas === "number" && Number.isFinite(config.replicas)) {
    return config.replicas;
  }
  return "";
};

const hasReplicas = (kind: NodeKind) => kind === "service";

export const NodeConfigPanel = ({
  node,
  isEditingLocked,
  onUpdateLabel,
  onUpdateConfig,
  onCommitDraft,
}: Props) => {
  if (!node) {
    return (
      <section className="panel">
        <div className="panel__title">Node Parameters</div>
        <div className="panel__content">
          <div className="muted">Select a node to edit its parameters.</div>
        </div>
      </section>
    );
  }

  const { data } = node;
  const config = data.config ?? {};
  const isPlatform = data.kind === "platform";
  const showPlatformConfig = data.layerId === "physical";
  const platformConfig = normalizePlatformConfig(config);
  const provider = normalizeProvider(config);
  const replicas = normalizeReplicas(config);

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateLabel(node.id, event.target.value);
  };

  const handleProviderChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateConfig(node.id, { ...config, provider: event.target.value });
  };

  const handleReplicasChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const nextConfig = { ...config };
    if (!value.trim()) {
      delete nextConfig.replicas;
      onUpdateConfig(node.id, nextConfig);
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      nextConfig.replicas = parsed;
      onUpdateConfig(node.id, nextConfig);
    }
  };

  const handlePlatformTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as PlatformType;
    onUpdateConfig(node.id, { ...config, platformType: nextType });
  };

  const handleSshHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateConfig(node.id, { ...config, sshHost: event.target.value });
  };

  return (
    <section className="panel">
      <div className="panel__title">Node Parameters</div>
      <div className="panel__content panel__content--stack">
        <div className="node-config__meta">
          <span>{data.kind}</span>
          <span>{data.layerId}</span>
        </div>
        <label className="field">
          <span>Label</span>
          <input
            value={data.label}
            onChange={handleLabelChange}
            onBlur={onCommitDraft}
            disabled={isEditingLocked}
          />
        </label>
        {isPlatform ? (
          <>
            {showPlatformConfig ? (
              <>
                <label className="field">
                  <span>Platform type</span>
                  <select
                    className="nodrag"
                    value={platformConfig.platformType ?? "ssh"}
                    onChange={handlePlatformTypeChange}
                    onBlur={onCommitDraft}
                    disabled={isEditingLocked}
                  >
                    <option value="ssh">SSH</option>
                  </select>
                </label>
                {platformConfig.platformType === "ssh" ? (
                  <label className="field">
                    <span>SSH IP address</span>
                    <input
                      className="nodrag"
                      value={platformConfig.sshHost ?? ""}
                      onChange={handleSshHostChange}
                      onBlur={onCommitDraft}
                      placeholder="e.g. 192.168.1.12"
                      disabled={isEditingLocked}
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <div className="muted">Platform parameters are available on the Physical layer.</div>
            )}
          </>
        ) : (
          <>
            <label className="field">
              <span>Provider</span>
              <input
                className="nodrag"
                value={provider}
                onChange={handleProviderChange}
                onBlur={onCommitDraft}
                placeholder="generic"
                disabled={isEditingLocked}
              />
            </label>
            {hasReplicas(data.kind) ? (
              <label className="field">
                <span>Replicas</span>
                <input
                  className="nodrag"
                  type="number"
                  min={1}
                  value={replicas}
                  onChange={handleReplicasChange}
                  onBlur={onCommitDraft}
                  placeholder="2"
                  disabled={isEditingLocked}
                />
              </label>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};
