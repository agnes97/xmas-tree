import { auth } from './auth.svelte';
import { DEFAULT_YEAR, ORNAMENTS } from './ornaments';
import { BAUBLES, DEFAULT_LAYOUT, type Position } from './tree/glassFir';

export type TreeStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

/** What can be told about a decoration: the year it joined the tree and a few words about it. */
export type StoryPatch = { year?: number; description?: string };
/** Where a bauble hangs and its story, as the account keeps it. */
export type Entry = Position & StoryPatch;
export type Layout = Record<string, Entry>;

/** A decoration as its bookmark shows it. */
export type Story = {
  id: string;
  name: string;
  color: string;
  year: number;
  description: string;
  /** It clips onto a branch rather than hanging on a string. */
  clipped: boolean;
  /** A picture of it taken from the tree, once there is one. */
  image?: string;
};

/** The account's layout over the default one: unknown baubles dropped, missing ones at home. */
const withDefaults = (layout: Layout): Layout =>
  Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([id, home]) => [id, layout[id] ?? home]));

const sameLayout = (a: Layout, b: Layout) =>
  Object.keys(a).every((id) => a[id].x === b[id]?.x && a[id].y === b[id]?.y);

const ORDER = new Map(BAUBLES.map(({ id }, i) => [id, i]));

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

  /** Pictures of the decorations taken from the tree, by id. */
  images = $state.raw<Record<string, string>>({});
  /** The decoration whose bookmark is hovered, so the tree can point it out. */
  hovered = $state<string | null>(null);
  storyError = $state<string | null>(null);

  /** The decorations by the year they joined the tree, newest first; ties keep the tree's order. */
  stories: Story[] = $derived.by(() => {
    const saved = this.saved;
    if (!saved) return [];
    return Object.keys(saved)
      .map((id) => ({
        id,
        name: ORNAMENTS[id]?.name ?? id,
        color: ORNAMENTS[id]?.color ?? '#888888',
        year: saved[id].year ?? DEFAULT_YEAR,
        description: saved[id].description ?? ORNAMENTS[id]?.description ?? '',
        clipped: !!ORNAMENTS[id]?.clipped,
        image: this.images[id],
      }))
      .toSorted((a, b) => b.year - a.year || (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0));
  });

  // Story edits are saved one after another, so quick edits reach the server in order.
  private queue: Promise<void> = Promise.resolve();

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
    this.storyError = null;
    this.hovered = null;
    this.status = 'idle';
  }

  edit() {
    if (this.saved) this.draft = this.saved;
  }

  move(id: string, position: Position) {
    if (this.draft) this.draft = { ...this.draft, [id]: { ...this.draft[id], ...position } };
  }

  /**
   * Changes a decoration's year or description and saves it straight away. It shows
   * at once and goes back if the save fails.
   */
  setStory(id: string, patch: StoryPatch) {
    if (!this.saved?.[id]) return;
    const generation = this.generation;
    const previous = this.saved[id];
    this.saved = { ...this.saved, [id]: { ...previous, ...patch } };
    // A position edit in progress keeps the story when it is saved.
    if (this.draft) this.draft = { ...this.draft, [id]: { ...this.draft[id], ...patch } };
    this.storyError = null;

    this.queue = this.queue.then(async () => {
      if (generation !== this.generation || !this.saved) return;
      try {
        const response = await auth.request('/xmas-tree', {
          method: 'PUT',
          body: JSON.stringify({ baubles: this.saved }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message ?? 'Failed to save the story');
        }
      } catch (error) {
        if (generation !== this.generation || !this.saved) return;
        // Put back only what this edit changed, unless a later edit has changed it again.
        const revert = (layout: Layout) => {
          const entry = { ...layout[id] };
          for (const key of Object.keys(patch) as (keyof StoryPatch)[]) {
            if (entry[key] !== patch[key]) continue;
            if (previous[key] === undefined) delete entry[key];
            else (entry as StoryPatch)[key] = previous[key] as never;
          }
          return { ...layout, [id]: entry };
        };
        this.saved = revert(this.saved);
        if (this.draft) this.draft = revert(this.draft);
        this.storyError = error instanceof Error ? error.message : 'Failed to save the story';
      }
    });
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
