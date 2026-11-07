<script lang="ts">
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from 'svelte/motion';
  import { fly } from 'svelte/transition';
  import { auth } from '../auth.svelte';
  import { tree, type StoryPatch } from '../tree.svelte';
  import Bookmark from './Bookmark.svelte';
  import StoryDialog from './StoryDialog.svelte';

  type Props = {
    /** On narrow or short screens the decorations live in a drawer over the tree. */
    open: boolean;
    onClose: () => void;
  };

  let { open, onClose }: Props = $props();

  const FLIP = 650;

  let rail = $state<HTMLElement>();
  let openId = $state<string | null>(null);
  /** The card that just changed its year: it lifts while it travels and shimmers where it lands. */
  let moved = $state<string | null>(null);
  let announcement = $state('');
  let movedTimer = 0;

  const stories = $derived(tree.stories);
  const duration = $derived(prefersReducedMotion.current ? 0 : FLIP);

  // An opened drawer takes the focus to its first decoration.
  $effect(() => {
    if (!open) return;
    const id = setTimeout(() => rail?.querySelector<HTMLElement>('.open')?.focus(), 60);
    return () => clearTimeout(id);
  });

  async function tell(id: string, patch: StoryPatch) {
    const before = stories.findIndex((s) => s.id === id);
    tree.setStory(id, patch);
    if (patch.year === undefined) return;
    await tick();
    const after = stories.findIndex((s) => s.id === id);
    const story = stories[after];
    if (!story) return;
    announcement =
      after === before
        ? `${story.name} joined the tree in ${story.year}.`
        : `${story.name} moved to ${story.year}, now ${after + 1} of ${stories.length}.`;
    clearTimeout(movedTimer);
    moved = id;
    movedTimer = window.setTimeout(() => (moved = null), duration + 900);
  }

  function hover(id: string | null) {
    if (id || tree.hovered) tree.hovered = id;
  }
</script>

<svelte:window
  onkeydown={(event) => {
    // Escape closes the drawer, unless it is closing a popup on top of it.
    if (event.key === 'Escape' && open && !document.querySelector('dialog[open]')) onClose();
  }}
/>

<aside bind:this={rail} id="rail" class={['rail', open && 'open']} aria-label="Decorations, newest first">
  <div class="rail-head">
    <button type="button" class="close" aria-label="Close decorations" onclick={onClose}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>

  {#if tree.storyError}
    <p class="error" role="alert">{tree.storyError}. The change was undone.</p>
  {/if}

  {#if stories.length}
    <ol aria-label="Decorations by year">
      {#each stories as story, i (story.id)}
        <li
          class={[moved === story.id && 'moved']}
          animate:flip={{ duration, easing: cubicInOut }}
          in:fly={{ x: -80, duration: duration ? 520 : 0, delay: duration ? 120 + i * 70 : 0, easing: cubicOut }}
          onpointerenter={() => hover(story.id)}
          onpointerleave={() => tree.hovered === story.id && hover(null)}
          onfocusin={() => hover(story.id)}
          onfocusout={() => tree.hovered === story.id && hover(null)}
        >
          <Bookmark
            {story}
            onOpen={() => (openId = story.id)}
            onYear={(year) => tell(story.id, { year })}
          />
        </li>
      {/each}
    </ol>
  {:else}
    <ol aria-hidden="true">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <li class={['ghost', auth.status !== 'unauthenticated' && tree.status !== 'error' && 'shimmer']}></li>
      {/each}
    </ol>
    {#if tree.status === 'error'}
      <p class="hint">{tree.error}</p>
    {/if}
  {/if}

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</aside>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class={['scrim', open && 'open']} onclick={onClose}></div>

<StoryDialog bind:openId {stories} onChange={tell} />

<style>
  .rail {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 30px 0 40px;
    font-family: var(--body);
  }

  .rail-head {
    display: none;
  }

  /* Rows share the height, so every card fits without scrolling. */
  /* Centred under the title; App works out where. */
  ol {
    --cols: 2;

    flex: 1;
    width: var(--list-w, 400px);
    margin-left: var(--list-x, 20px);
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-auto-rows: minmax(0, 176px);
    align-content: start;
    gap: 10px;
    min-height: 0;
    margin-block: 0;
    padding: 3px;
    list-style: none;
  }

  li {
    container: card / size;
    position: relative;
    min-height: 0;
  }

  /* The card that changed its year lifts above the others while it travels... */
  li.moved {
    z-index: 2;
  }

  li.moved :global(.card) {
    transform: scale(1.025);
    box-shadow:
      inset 0 0 0 1.5px var(--pine-deep),
      inset 0 0 0 3px var(--gold),
      0 16px 32px -10px rgb(0 0 0 / 0.8);
  }

  /* ...and a gold shimmer runs across it where it lands. */
  li.moved::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    border-radius: 14px;
    background: linear-gradient(100deg, transparent 30%, rgb(255 214 120 / 0.55) 50%, transparent 70%);
    background-size: 250% 100%;
    background-position: 120% 0;
    pointer-events: none;
    animation: shimmer 0.9s ease-out 0.62s both;
  }

  @keyframes shimmer {
    from {
      background-position: 120% 0;
      opacity: 1;
    }
    to {
      background-position: -60% 0;
      opacity: 0;
    }
  }

  .ghost {
    border: 1px dashed var(--border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface) 60%, transparent);
  }

  .shimmer {
    background: linear-gradient(
      90deg,
      var(--surface) 25%,
      color-mix(in srgb, var(--border) 60%, var(--surface)) 50%,
      var(--surface) 75%
    );
    background-size: 300% 100%;
    animation: loading 1.4s linear infinite;
  }

  @keyframes loading {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  .hint,
  .error {
    margin: 0 10px 10px var(--title-left, 10px);
    font-size: 14px;
    color: var(--text-muted);
  }

  .hint {
    margin-top: 14px;
  }

  .error {
    color: var(--title);
  }

  .scrim {
    display: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Narrow, or too short for every card: the decorations slide out in a drawer. */
  @container app (max-width: 760px) or (max-height: 560px) {
    .rail {
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 6;
      width: min(360px, 90%);
      padding: 18px 8px 24px max(12px, env(safe-area-inset-left, 0px));
      background: var(--ground);
      box-shadow: 18px 0 40px -20px rgb(0 0 0 / 0.5);
      transform: translateX(-104%);
      visibility: hidden;
      transition:
        transform 0.36s var(--ease-out),
        visibility 0s linear 0.36s;
    }

    .rail.open {
      transform: none;
      visibility: visible;
      transition: transform 0.36s var(--ease-out);
    }

    .rail-head {
      display: flex;
      justify-content: flex-end;
      padding: 0 4px 4px;
    }

    .close {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin: -6px -2px 0 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text);
      cursor: pointer;
    }

    .close:hover {
      background: color-mix(in srgb, var(--text) 8%, transparent);
    }

    .close:focus-visible {
      outline: 2px solid var(--focus);
    }

    ol {
      width: auto;
      margin-left: 0;
      grid-auto-rows: 112px;
      padding-bottom: 12px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: none;
    }

    .scrim {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: block;
      background: var(--scrim);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }

    .scrim.open {
      opacity: 1;
      pointer-events: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    li.moved::after,
    .shimmer {
      animation: none;
    }

    .rail,
    .rail.open {
      transition: none;
    }
  }
</style>
