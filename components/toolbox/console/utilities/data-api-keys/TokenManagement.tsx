"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GlacierApiClient } from "./api";
import { ApiKeyListItem, CreateApiKeyResponse } from "./types";
import ApiKeysList from "./ApiKeysList";
import CreateApiKeyModal from "./CreateApiKeyModal";
import ApiKeyCreatedModal from "./ApiKeyCreatedModal";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { AccountRequirementsConfigKey } from "../../../hooks/useAccountRequirements";

interface GlacierJwtResponse {
  glacierJwt: string;
  endpoint: string;
}

const metadata: ConsoleToolMetadata = {
  title: "API Keys",
  description:
    "Manage your API keys for accessing the Data & Metrics APIs. Create, view, and revoke keys as needed for your applications.",
  toolRequirements: [AccountRequirementsConfigKey.UserLoggedIn],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function TokenManagementInner({ onSuccess }: BaseConsoleToolProps) {
  // JWT state
  const [jwtData, setJwtData] = useState<GlacierJwtResponse | null>(null);
  const [jwtLoading, setJwtLoading] = useState(true);
  const [jwtError, setJwtError] = useState<string | null>(null);

  // API client ref
  const apiClientRef = useRef<GlacierApiClient | null>(null);

  // State
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxApiKeysAllowed, setMaxApiKeysAllowed] = useState(10);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(
    null
  );

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyListItem | null>(null);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());

  // Fetch JWT on mount
  useEffect(() => {
    const fetchJwt = async () => {
      setJwtLoading(true);
      setJwtError(null);

      try {
        const response = await fetch("/api/glacier-jwt");
        if (!response.ok) {
          if (response.status === 401) {
            setJwtError("Please log in to manage your API keys");
          } else {
            setJwtError("Failed to initialize. Please try again.");
          }
          return;
        }

        const data: GlacierJwtResponse = await response.json();
        setJwtData(data);
        apiClientRef.current = new GlacierApiClient(
          data.glacierJwt,
          data.endpoint
        );
      } catch (err) {
        console.error("Failed to fetch JWT:", err);
        setJwtError("Failed to initialize. Please try again.");
      } finally {
        setJwtLoading(false);
      }
    };

    fetchJwt();
  }, []);

  // Load API keys when JWT is available
  const fetchApiKeys = async () => {
    if (!apiClientRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClientRef.current.listApiKeys();
      setApiKeys(response.keys);
      setMaxApiKeysAllowed(response.maxApiKeysAllowed);
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  // Load API keys when jwtData changes
  useEffect(() => {
    if (jwtData && apiClientRef.current) {
      fetchApiKeys();
    }
  }, [jwtData]);

  // Create API key
  const handleCreateApiKey = async (alias: string) => {
    if (!apiClientRef.current) return;

    setIsCreating(true);

    try {
      const response = await apiClientRef.current.createApiKey({ alias });
      setCreatedKey(response);
      setShowCreateModal(false);

      toast.success("API key created successfully");

      // Delay to allow API to update
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchApiKeys();
    } catch (err) {
      console.error("Failed to create API key:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create API key";
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  // Delete API key
  const handleDeleteApiKey = (keyId: string) => {
    const apiKey = apiKeys.find((k) => k.keyId === keyId);
    if (apiKey) {
      setKeyToDelete(apiKey);
      setShowDeleteDialog(true);
    }
  };

  const confirmDeleteApiKey = async () => {
    if (!keyToDelete || !apiClientRef.current) return;

    setDeletingKeys((prev) => new Set(prev).add(keyToDelete.keyId));

    try {
      await apiClientRef.current.deleteApiKey(keyToDelete.keyId);

      setShowDeleteDialog(false);
      setKeyToDelete(null);
      toast.success("API key deleted successfully");

      // Delay to allow API to update
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchApiKeys();
    } catch (err) {
      console.error("Failed to delete API key:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete API key";
      toast.error(errorMessage);
    } finally {
      setDeletingKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(keyToDelete.keyId);
        return newSet;
      });
    }
  };

  const maxKeysReached = apiKeys.length >= maxApiKeysAllowed;

  // Show loading state while fetching JWT
  if (jwtLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <span className="ml-3 text-zinc-500 dark:text-zinc-400">
          Initializing...
        </span>
      </div>
    );
  }

  // Show error state if JWT fetch failed
  if (jwtError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-500 dark:text-red-400 mb-4">{jwtError}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Create API Key Modal */}
      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        onSubmit={handleCreateApiKey}
        isCreating={isCreating}
        maxKeysReached={maxKeysReached}
      />

      {/* API Key Created Modal */}
      <ApiKeyCreatedModal
        isOpen={!!createdKey}
        onClose={() => setCreatedKey(null)}
        createdKey={createdKey}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        apiKey={keyToDelete}
        onConfirm={confirmDeleteApiKey}
        onCancel={() => {
          setShowDeleteDialog(false);
          setKeyToDelete(null);
        }}
        isDeleting={deletingKeys.has(keyToDelete?.keyId || "")}
      />

      {/* Header with Create Button */}
      <div className="mb-8 not-prose">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
              Your API Keys
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Manage access tokens for the Data & Metrics API
            </p>
          </div>
          <Button
            onClick={() => {
              setShowCreateModal(true);
            }}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create API Key
          </Button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="not-prose">
        <ApiKeysList
          apiKeys={apiKeys}
          isLoading={isLoading}
          error={error}
          maxApiKeysAllowed={maxApiKeysAllowed}
          deletingKeys={deletingKeys}
          onRefresh={fetchApiKeys}
          onShowCreateForm={() => {
            setShowCreateModal(true);
          }}
          onDeleteKey={handleDeleteApiKey}
        />
      </div>
    </>
  );
}

export default withConsoleToolMetadata(TokenManagementInner, metadata);
