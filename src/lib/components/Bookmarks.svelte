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

  const FLIP = 650;

  let openId = $state<string | null>(null);
  /** The bookmark that just changed its year: it lifts while it travels and shimmers where it lands. */
  let moved = $state<string | null>(null);
  let announcement = $state('');
  let movedTimer = 0;

  const stories = $derived(tree.stories);
  const duration = $derived(prefersReducedMotion.current ? 0 : FLIP);

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

<aside class="rail" aria-labelledby="rail-title">
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
    <ol class="ghosts" aria-hidden="true">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <li class={['ghost', auth.status !== 'unauthenticated' && 'shimmer']}></li>
      {/each}
    </ol>
    {#if auth.status === 'unauthenticated'}
      <p class="hint">Log in to read your decorations' stories.</p>
    {:else if tree.status === 'error'}
      <p class="hint">{tree.error}</p>
    {/if}
  {/if}

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</aside>

<StoryDialog bind:openId {stories} onChange={tell} />

<style>
  .rail {
    position: sticky;
    top: 0;
    align-self: start;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 22px 16px 32px 0;
    font-family: var(--body);
    scrollbar-width: thin;
  }

  header {
    padding: 0 0 14px max(24px, env(safe-area-inset-left, 0px));
  }

  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
    color: var(--title);
  }

  header p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 4px 0;
    list-style: none;
  }

  li {
    position: relative;
  }

  /* The bookmark that changed its year lifts above the others while it travels... */
  li.moved {
    z-index: 2;
  }

  li.moved :global(.tab) {
    transform: scale(1.025);
    box-shadow:
      0 4px 8px rgb(0 0 0 / 0.1),
      0 16px 32px -10px color-mix(in srgb, var(--ink) 75%, transparent);
  }

  /* ...and a gold shimmer runs across it where it lands. */
  li.moved::after {
    content: '';
    position: absolute;
    inset: 0 12% 0 0;
    z-index: 3;
    border-radius: 0 999px 999px 0;
    background: linear-gradient(
      100deg,
      transparent 30%,
      rgb(255 214 120 / 0.65) 50%,
      transparent 70%
    );
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
    width: 82%;
    height: 84px;
    border: 1px dashed var(--border);
    border-left: none;
    border-radius: 0 999px 999px 0;
    background: color-mix(in srgb, var(--surface) 60%, transparent);
  }

  .ghost:nth-child(2n) {
    width: 70%;
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
    margin: 14px 0 0 max(24px, env(safe-area-inset-left, 0px));
    font-size: 14px;
    color: var(--text-muted);
  }

  .error {
    margin: 0 0 12px max(24px, env(safe-area-inset-left, 0px));
    color: var(--danger);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    li.moved::after,
    .shimmer {
      animation: none;
    }
  }

  @media (max-width: 760px) {
    .rail {
      position: static;
      max-height: none;
      overflow: visible;
      padding: 16px 0 4px;
    }

    header {
      padding-left: max(16px, env(safe-area-inset-left, 0px));
    }

    ol {
      flex-direction: row;
      overflow-x: auto;
      padding: 6px 16px 12px 0;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
    }

    li {
      flex: none;
      width: min(270px, 78vw);
      scroll-snap-align: start;
    }

    .ghost,
    .ghost:nth-child(2n) {
      width: min(270px, 78vw);
      height: 76px;
    }
  }
</style>
