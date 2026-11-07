<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { MAX_DESCRIPTION, ORNAMENTS } from '../ornaments';
  import { tree, type Story, type StoryPatch } from '../tree.svelte';
  import type { View } from '../tree/glassFir';
  import EditableYear from './EditableYear.svelte';
  import FestivePanel from './festive/FestivePanel.svelte';
  import GoldButton from './festive/GoldButton.svelte';

  type Props = {
    /** The decoration whose story is open, or null when closed. */
    openId: string | null;
    /** All the decorations in year order, for stepping through them. */
    stories: Story[];
    onChange: (id: string, patch: StoryPatch) => void;
  };

  let { openId = $bindable(), stories, onChange }: Props = $props();

  const index = $derived(stories.findIndex((s) => s.id === openId));
  const story = $derived(index >= 0 ? stories[index] : null);

  let editing = $state(false);
  let draft = $state('');

  const sync: Attachment<HTMLDialogElement> = (dialog) => {
    if (openId && !dialog.open) dialog.showModal();
    if (!openId && dialog.open) dialog.close();
  };

  // The decoration as it hangs on the tree, turning, to spin by dragging across it.
  const live =
    (view: View, id: string): Attachment<HTMLCanvasElement> =>
    (canvas) =>
      view(id, canvas);

  const select: Attachment<HTMLTextAreaElement> = (area) => {
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  };

  function startEditing() {
    if (!story) return;
    draft = story.description;
    editing = true;
  }

  function finishEditing(save: boolean) {
    if (!editing || !story) return;
    editing = false;
    if (!save) return;
    const text = draft.trim();
    if (text === story.description) return;
    // An emptied description goes back to the one the decoration came with.
    const original = ORNAMENTS[story.id]?.description;
    onChange(story.id, { description: text && text !== original ? text : undefined });
  }

  function step(by: number) {
    if (!stories.length || index < 0) return;
    finishEditing(true);
    openId = stories[(index + by + stories.length) % stories.length].id;
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea')) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  }

  function onAreaKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Stop editing, but keep the story open.
      event.preventDefault();
      event.stopPropagation();
      finishEditing(false);
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finishEditing(true);
    }
  }
</script>

<dialog
  {@attach sync}
  class="story"
  aria-labelledby="story-name"
  onclose={() => {
    finishEditing(true);
    openId = null;
  }}
  onclick={(event) => {
    if (event.target === event.currentTarget) openId = null;
  }}
  {onkeydown}
>
  {#if story}
    <FestivePanel garland holly>

      <GoldButton shape="round" class="close" aria-label="Close" onclick={() => (openId = null)}>×</GoldButton>

      <div class="body">
        <figure style:--ink={story.color}>
          <div class={['hanger', story.clipped && 'clipped']}>
            {#if !story.clipped}
              <span class="string"></span>
            {/if}
            {#if tree.view}
              {#key story.id}
                <canvas {@attach live(tree.view, story.id)} title="Drag to spin">
                  The {story.name}; drag across it to spin it.
                </canvas>
              {/key}
            {:else if story.image}
              {#key story.id}
                <img src={story.image} alt={`The ${story.name}`} />
              {/key}
            {:else}
              <span class="glass" role="img" aria-label={`The ${story.name}`}></span>
            {/if}
          </div>
        </figure>

        <div class="words">
          <EditableYear
            value={story.year}
            name={story.name}
            size="hero"
            onCommit={(year) => onChange(story.id, { year })}
          />
          <h2 id="story-name">{story.name}</h2>

          <div class="tag">
            <svg class="twine" viewBox="0 0 60 70" aria-hidden="true">
              <path d="M44 34 C30 30 22 12 6 4 M44 34 C30 40 26 56 10 66" fill="none" stroke="#c8202f" stroke-width="2" stroke-linecap="round" />
            </svg>
            <div class="card">
              {#if editing}
                <textarea
                  {@attach select}
                  bind:value={draft}
                  maxlength={MAX_DESCRIPTION}
                  rows="6"
                  aria-label={`Story of the ${story.name}`}
                  onkeydown={onAreaKeydown}
                  onblur={() => finishEditing(true)}
                ></textarea>
                <span class="count">{draft.length} / {MAX_DESCRIPTION} · ⌘↵ to save · Esc to cancel</span>
              {:else}
                <button type="button" class="description" title="Edit the story" onclick={startEditing}>
                  {story.description}
                  <span class="pencil" aria-hidden="true">✎</span>
                  <span class="visually-hidden">Edit the story</span>
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <GoldButton shape="round" aria-label="Previous decoration" onclick={() => step(-1)}>‹</GoldButton>
        <span>{index + 1} of {stories.length}</span>
        <GoldButton shape="round" aria-label="Next decoration" onclick={() => step(1)}>›</GoldButton>
      </footer>
    </FestivePanel>
  {/if}
</dialog>

<style>
  .story {
    position: fixed;
    width: min(760px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 0;
    overflow: hidden auto;
    border: none;
    border-radius: 22px;
    background: var(--pine);
    box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.7);
  }

  .story[open] {
    animation: drop 0.55s cubic-bezier(0.2, 1.35, 0.4, 1);
  }

  .story::backdrop {
    background: rgb(8 18 13 / 0.6);
    backdrop-filter: blur(4px);
    animation: fade 0.3s ease-out;
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-16px) scale(0.98);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .story :global(.close) {
    position: absolute;
    top: 14px;
    right: 16px;
    z-index: 2;
    background: var(--pine);
  }

  .description:focus-visible {
    outline: 3px solid var(--cream);
    outline-offset: 2px;
  }

  .body {
    position: relative;
    display: grid;
    grid-template-columns: minmax(200px, 300px) 1fr;
    gap: 28px;
    padding: 64px 36px 8px;
  }

  figure {
    margin: 0;
    display: flex;
    justify-content: center;
    background: radial-gradient(
      closest-side at 50% 58%,
      rgb(255 214 130 / 0.35),
      color-mix(in srgb, var(--ink) 25%, transparent) 60%,
      transparent
    );
  }

  .hanger {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    transform-origin: 50% 0;
    animation: sway 5s ease-in-out infinite;
  }

  .string {
    width: 1.5px;
    height: 62px;
    margin-top: -40px;
    background: linear-gradient(var(--gold), #b8892b);
  }

  .hanger :is(img, canvas) {
    width: min(280px, 100%);
    aspect-ratio: 1;
    object-fit: contain;
    margin-top: -26px;
    filter: drop-shadow(0 16px 20px rgb(0 0 0 / 0.45));
    animation: appear 0.4s ease-out;
  }

  .clipped {
    justify-content: center;
    min-height: 240px;
    animation-duration: 7s;
  }

  canvas {
    cursor: grab;
    touch-action: none;
  }

  .clipped :is(img, canvas) {
    margin-top: 0;
  }

  .glass {
    width: 180px;
    height: 180px;
    margin: 30px 0 50px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, white 70%, var(--ink)),
      var(--ink) 55%,
      color-mix(in srgb, black 40%, var(--ink))
    );
    box-shadow: 0 16px 30px rgb(0 0 0 / 0.4);
  }

  @keyframes sway {
    0%,
    100% {
      transform: rotate(-2.2deg);
    }
    50% {
      transform: rotate(2.2deg);
    }
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
  }

  .words {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    padding-top: 14px;
  }

  .words :global(.year.hero) {
    margin-left: -0.32em;
  }

  h2 {
    margin: 0 0 18px;
    font-size: 15px;
    font-weight: 700;
    font-variant: small-caps;
    letter-spacing: 0.12em;
    color: var(--gold);
  }

  .tag {
    position: relative;
    align-self: stretch;
    padding-left: 30px;
  }

  .twine {
    position: absolute;
    left: -6px;
    top: 50%;
    width: 60px;
    height: 70px;
    translate: 0 -50%;
  }

  .card {
    position: relative;
    padding: 18px 20px 18px 44px;
    background: var(--cream);
    color: #3b2a1a;
    clip-path: polygon(26px 0, 100% 0, 100% 100%, 26px 100%, 0 50%);
    rotate: -1.5deg;
    filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.3));
  }

  .card::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 50%;
    width: 12px;
    height: 12px;
    translate: 0 -50%;
    border-radius: 50%;
    background: #123425;
    box-shadow: inset 0 0 0 2px #d8c9a4;
  }

  .description {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 16px;
    line-height: 1.6;
    text-align: left;
    white-space: pre-line;
    cursor: text;
  }

  .pencil {
    display: inline-block;
    margin-left: 6px;
    color: #a51826;
    opacity: 0.55;
    transition: opacity 0.2s;
  }

  .description:hover .pencil,
  .description:focus-visible .pencil {
    opacity: 1;
  }

  textarea {
    display: block;
    width: 100%;
    padding: 6px 8px;
    border: 1.5px dashed #a51826;
    border-radius: 6px;
    background: #fffaf0;
    color: inherit;
    font: inherit;
    font-size: 16px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
  }

  .count {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: #7a6650;
  }

  footer {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 18px 0 26px;
    font-size: 14px;
    color: color-mix(in srgb, var(--cream) 75%, transparent);
    font-variant-numeric: tabular-nums;
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
    .story[open],
    .story::backdrop,
    .hanger,
    .hanger :is(img, canvas) {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 58px 20px 4px;
    }

    .hanger :is(img, canvas) {
      width: min(220px, 70vw);
    }

    .words {
      align-items: center;
      text-align: center;
    }
  }
</style>
