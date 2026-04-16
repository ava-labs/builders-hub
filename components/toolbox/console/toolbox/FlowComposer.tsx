'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Plus, GripVertical, X, Play, Save, Trash2, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tool catalog — every composable step
// ---------------------------------------------------------------------------

interface ComposerTool {
  id: string;
  name: string;
  category: string;
  description: string;
}

const TOOL_CATALOG: ComposerTool[] = [
  // Chain creation
  {
    id: 'create-subnet',
    name: 'Create Subnet',
    category: 'Creation',
    description: 'Create a new subnet on the P-Chain',
  },
  {
    id: 'create-chain',
    name: 'Create Chain',
    category: 'Creation',
    description: 'Deploy a new blockchain with custom genesis',
  },
  {
    id: 'convert-to-l1',
    name: 'Convert to L1',
    category: 'Creation',
    description: 'Convert a subnet to an Avalanche L1',
  },
  // Infrastructure
  {
    id: 'managed-nodes',
    name: 'Managed Nodes',
    category: 'Infrastructure',
    description: 'Setup managed testnet nodes',
  },
  {
    id: 'docker-setup',
    name: 'Docker Node Setup',
    category: 'Infrastructure',
    description: 'Run AvalancheGo in Docker',
  },
  // Validator Manager
  {
    id: 'deploy-vm',
    name: 'Deploy Validator Manager',
    category: 'Validator Manager',
    description: 'Deploy the validator manager contract',
  },
  {
    id: 'proxy-setup',
    name: 'Proxy Setup',
    category: 'Validator Manager',
    description: 'Point proxy to implementation',
  },
  {
    id: 'initialize-vm',
    name: 'Initialize Manager',
    category: 'Validator Manager',
    description: 'Initialize the validator manager',
  },
  {
    id: 'init-validator-set',
    name: 'Init Validator Set',
    category: 'Validator Manager',
    description: 'Bootstrap the initial validator set',
  },
  // Staking
  {
    id: 'deploy-native-staking',
    name: 'Deploy Native Staking Manager',
    category: 'Staking',
    description: 'Deploy native token staking',
  },
  {
    id: 'deploy-erc20-staking',
    name: 'Deploy ERC20 Staking Manager',
    category: 'Staking',
    description: 'Deploy ERC20 token staking',
  },
  {
    id: 'deploy-reward-calc',
    name: 'Deploy Reward Calculator',
    category: 'Staking',
    description: 'Deploy the reward calculator',
  },
  {
    id: 'initialize-staking',
    name: 'Initialize Staking Manager',
    category: 'Staking',
    description: 'Initialize staking parameters',
  },
  { id: 'enable-minting', name: 'Enable Minting', category: 'Staking', description: 'Enable staking manager minting' },
  {
    id: 'transfer-ownership',
    name: 'Transfer Ownership',
    category: 'Staking',
    description: 'Transfer ownership to staking manager',
  },
  // Cross-chain
  { id: 'icm-setup', name: 'ICM Setup', category: 'Cross-Chain', description: 'Deploy Interchain Messaging contracts' },
  {
    id: 'ictt-setup',
    name: 'Token Bridge Setup',
    category: 'Cross-Chain',
    description: 'Deploy token bridge contracts',
  },
  // Multisig
  {
    id: 'deploy-poa-manager',
    name: 'Deploy PoA Manager',
    category: 'Governance',
    description: 'Deploy multisig PoA manager',
  },
  {
    id: 'transfer-vm-ownership',
    name: 'Transfer VM Ownership',
    category: 'Governance',
    description: 'Transfer validator manager ownership',
  },
];

const CATEGORIES = [...new Set(TOOL_CATALOG.map((t) => t.category))];

// ---------------------------------------------------------------------------
// Sortable pipeline item
// ---------------------------------------------------------------------------

interface PipelineItemProps {
  tool: ComposerTool;
  index: number;
  onRemove: () => void;
}

function SortablePipelineItem({ tool, index, onRemove }: PipelineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `pipeline-${tool.id}-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        isDragging
          ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 shadow-lg z-10'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{tool.name}</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{tool.description}</p>
      </div>

      <button type="button" onClick={onRemove} className="text-zinc-400 hover:text-red-500 transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Composer
// ---------------------------------------------------------------------------

export default function FlowComposer() {
  const _router = useRouter();
  const [pipeline, setPipeline] = useState<ComposerTool[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [savedFlows, setSavedFlows] = useState<{ name: string; tools: ComposerTool[] }[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('composer-saved-flows') || '[]');
    } catch {
      return [];
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addTool = useCallback((tool: ComposerTool) => {
    setPipeline((prev) => [...prev, { ...tool }]);
  }, []);

  const removeTool = useCallback((index: number) => {
    setPipeline((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = pipeline.findIndex((_, i) => `pipeline-${pipeline[i].id}-${i}` === active.id);
      const newIndex = pipeline.findIndex((_, i) => `pipeline-${pipeline[i].id}-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setPipeline(arrayMove(pipeline, oldIndex, newIndex));
      }
    },
    [pipeline],
  );

  const filteredCatalog = useMemo(() => TOOL_CATALOG.filter((t) => t.category === activeCategory), [activeCategory]);

  const saveFlow = useCallback(() => {
    if (pipeline.length === 0) return;
    const name = prompt('Name this flow:');
    if (!name) return;
    const updated = [...savedFlows, { name, tools: [...pipeline] }];
    setSavedFlows(updated);
    localStorage.setItem('composer-saved-flows', JSON.stringify(updated));
  }, [pipeline, savedFlows]);

  const loadFlow = useCallback((flow: { name: string; tools: ComposerTool[] }) => {
    setPipeline([...flow.tools]);
  }, []);

  const deleteFlow = useCallback(
    (index: number) => {
      const updated = savedFlows.filter((_, i) => i !== index);
      setSavedFlows(updated);
      localStorage.setItem('composer-saved-flows', JSON.stringify(updated));
    },
    [savedFlows],
  );

  const sortableItems = pipeline.map((tool, i) => `pipeline-${tool.id}-${i}`);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Flow Composer</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Build custom deployment flows by adding and reordering steps. Drag to reorder.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Tool palette ── */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Available Steps
          </h3>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tool cards */}
          <div className="space-y-1.5">
            {filteredCatalog.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => addTool(tool)}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-left hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{tool.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{tool.description}</p>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>

          {/* Saved flows */}
          {savedFlows.length > 0 && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Saved Flows
              </h3>
              {savedFlows.map((flow, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => loadFlow(flow)}
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {flow.name}
                    <span className="ml-2 text-xs text-zinc-400">{flow.tools.length} steps</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFlow(i)}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Pipeline ── */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Your Flow ({pipeline.length} steps)
            </h3>
            <div className="flex items-center gap-2">
              {pipeline.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={saveFlow}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Save className="h-3 w-3" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipeline([])}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {pipeline.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <Plus className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Click steps from the palette to add them here.</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Drag to reorder. Build any flow you need.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                  <AnimatePresence>
                    {pipeline.map((tool, index) => (
                      <motion.div
                        key={`${tool.id}-${index}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SortablePipelineItem tool={tool} index={index} onRemove={() => removeTool(index)} />
                        {index < pipeline.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-700 rotate-90" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Run button — disabled until Composer → StepFlow integration lands.
              Leaves the CTA visible so users can see the feature roadmap
              without shipping a broken alert() placeholder. */}
          {pipeline.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled
                title="Running a composed flow is not available yet."
                className="inline-flex items-center gap-3 rounded-xl bg-zinc-200 dark:bg-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              >
                <Play className="h-4 w-4" />
                Run Flow
                <ArrowRight className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Coming soon</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
