import { auth } from './auth.svelte';
import { DEFAULT_LAYOUT, type Layout, type Position } from './tree/glassFir';

export type TreeStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

/** The account's layout over the default one: unknown baubles dropped, missing ones at home. */
const withDefaults = (layout: Layout): Layout =>
  Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([id, home]) => [id, layout[id] ?? home]));

const sameLayout = (a: Layout, b: Layout) =>
  Object.keys(a).every((id) => a[id].x === b[id]?.x && a[id].y === b[id]?.y);

class Tree {
  /** The account's saved layout; null while logged out or loading. */
  saved = $state.raw<Layout | null>(null);
  /** The layout being edited; null outside edit mode. */
  draft = $state.raw<Layout | null>(null);
  status = $state<TreeStatus>('idle');
  error = $state<string | null>(null);

  isEditing = $derived(this.draft !== null);
  /** What the tree shows; null for a bare tree. */
  layout = $derived(this.draft ?? this.saved);
  isDirty = $derived(!!this.draft && !!this.saved && !sameLayout(this.draft, this.saved));

  // Bumped on every load and reset, so a response for a user who has since logged out is dropped.
  private generation = 0;

  async load() {
    const generation = ++this.generation;
    this.status = 'loading';
    this.error = null;

    try {
      const response = await auth.request('/xmas-tree');
      if (!response.ok) throw new Error('Failed to load your tree');
      const data: { baubles: Layout } = await response.json();
      if (generation !== this.generation) return;
      this.saved = withDefaults(data.baubles);
      this.status = 'ready';
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'Failed to load your tree';
      this.status = 'error';
    }
  }

  reset() {
    this.generation++;
    this.saved = null;
    this.draft = null;
    this.error = null;
    this.status = 'idle';
  }

  edit() {
    if (this.saved) this.draft = this.saved;
  }

  move(id: string, position: Position) {
    if (this.draft) this.draft = { ...this.draft, [id]: position };
  }

  discard() {
    this.draft = null;
    this.error = null;
  }

  async save() {
    if (!this.draft) return;
    const generation = this.generation;
    this.status = 'saving';
    this.error = null;

    try {
      const response = await auth.request('/xmas-tree', {
        method: 'PUT',
        body: JSON.stringify({ baubles: this.draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Failed to save your tree');
      if (generation !== this.generation) return;
      this.saved = withDefaults(data.baubles);
      this.draft = null;
      this.status = 'ready';
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'Failed to save your tree';
      this.status = 'ready';
    }
  }
}

export const tree = new Tree();
