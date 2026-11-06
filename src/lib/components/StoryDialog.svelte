<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { MAX_DESCRIPTION, ORNAMENTS } from '../ornaments';
  import type { Story, StoryPatch } from '../tree.svelte';
  import EditableYear from './EditableYear.svelte';

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

  // Snowflakes with fixed, varied paths, so they don't all fall in step.
  const flakes = Array.from({ length: 24 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      left: `${(r(1) * 100).toFixed(1)}%`,
      size: `${(3 + r(2) * 5).toFixed(1)}px`,
      duration: `${(7 + r(3) * 8).toFixed(1)}s`,
      delay: `${(-r(4) * 15).toFixed(1)}s`,
      drift: `${((r(5) - 0.5) * 60).toFixed(0)}px`,
      opacity: (0.45 + r(6) * 0.5).toFixed(2),
    };
  });

  const sync: Attachment<HTMLDialogElement> = (dialog) => {
    if (openId && !dialog.open) dialog.showModal();
    if (!openId && dialog.open) dialog.close();
  };

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
    <div class="snow" aria-hidden="true">
      {#each flakes as flake, i (i)}
        <span
          style:left={flake.left}
          style:width={flake.size}
          style:height={flake.size}
          style:opacity={flake.opacity}
          style:animation-duration={flake.duration}
          style:animation-delay={flake.delay}
          style:--drift={flake.drift}
        ></span>
      {/each}
    </div>

    <svg class="garland" viewBox="0 0 720 84" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <g fill="none" stroke-linecap="round">
        <path d="M-10 6 Q180 66 360 16 Q540 66 730 6" stroke="#0b3322" stroke-width="24" />
        <path d="M-10 6 Q180 66 360 16 Q540 66 730 6" stroke="#1b5e3d" stroke-width="20" stroke-dasharray="2 3" />
        <path d="M-10 6 Q180 66 360 16 Q540 66 730 6" stroke="#2c7d51" stroke-width="13" stroke-dasharray="1.5 4.5" />
        <path d="M-10 6 Q180 66 360 16 Q540 66 730 6" stroke="#5ba377" stroke-width="7" stroke-dasharray="1 7" />
      </g>
      <g class="dangles">
        {#each [
          { x: 108, y: 31, c: '#c0283c', len: 14 },
          { x: 216, y: 36, c: '#e2b33e', len: 20 },
          { x: 504, y: 36, c: '#e2b33e', len: 20 },
          { x: 612, y: 31, c: '#c0283c', len: 14 },
        ] as d (d.x)}
          <line x1={d.x} y1={d.y} x2={d.x} y2={d.y + d.len} stroke="#e8c76a" stroke-width="1" />
          <rect x={d.x - 3} y={d.y + d.len - 2} width="6" height="4" rx="1" fill="#d8d0b8" />
          <circle cx={d.x} cy={d.y + d.len + 9} r="9" fill={d.c} />
          <circle cx={d.x - 3} cy={d.y + d.len + 6} r="2.6" fill="white" opacity="0.55" />
        {/each}
      </g>
      <g class="bow">
        <path d="M360 18 C340 -2 316 4 322 20 C328 34 348 26 360 18Z" fill="#c8202f" />
        <path d="M360 18 C380 -2 404 4 398 20 C392 34 372 26 360 18Z" fill="#c8202f" />
        <path d="M356 20 L340 52 L348 50 L352 58 L360 24Z" fill="#a51826" />
        <path d="M364 20 L380 52 L372 50 L368 58 L360 24Z" fill="#a51826" />
        <circle cx="360" cy="19" r="6.5" fill="#e0303f" />
      </g>
    </svg>

    <svg class="holly left" viewBox="0 0 90 60" aria-hidden="true">
      <path d="M8 52 C14 38 30 30 46 32 L42 37 L50 40 L43 43 L46 50 L37 47 L32 53 L28 46 L20 52 L19 45Z" fill="#1f6b45" />
      <path d="M46 32 C58 18 74 14 86 18 L80 22 L86 28 L78 29 L78 37 L71 33 L64 39 L62 31 L54 35 L55 29Z" fill="#2c7d51" />
      <circle cx="46" cy="34" r="5" fill="#d0243a" />
      <circle cx="53" cy="38" r="4.5" fill="#b81c31" />
      <circle cx="42" cy="40" r="4" fill="#e03246" />
    </svg>
    <svg class="holly right" viewBox="0 0 90 60" aria-hidden="true">
      <path d="M8 52 C14 38 30 30 46 32 L42 37 L50 40 L43 43 L46 50 L37 47 L32 53 L28 46 L20 52 L19 45Z" fill="#1f6b45" />
      <path d="M46 32 C58 18 74 14 86 18 L80 22 L86 28 L78 29 L78 37 L71 33 L64 39 L62 31 L54 35 L55 29Z" fill="#2c7d51" />
      <circle cx="46" cy="34" r="5" fill="#d0243a" />
      <circle cx="53" cy="38" r="4.5" fill="#b81c31" />
      <circle cx="42" cy="40" r="4" fill="#e03246" />
    </svg>

    <button type="button" class="close" aria-label="Close" onclick={() => (openId = null)}>×</button>

    <div class="body">
      <figure style:--ink={story.color}>
        <div class={['hanger', story.clipped && 'clipped']}>
          {#if !story.clipped}
            <span class="string"></span>
          {/if}
          {#if story.image}
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
      <button type="button" class="step" aria-label="Previous decoration" onclick={() => step(-1)}>‹</button>
      <span>{index + 1} of {stories.length}</span>
      <button type="button" class="step" aria-label="Next decoration" onclick={() => step(1)}>›</button>
    </footer>
  {/if}
</dialog>

<style>
  .story {
    --gold: #e6b94a;
    --cream: #f6ecd4;

    position: fixed;
    width: min(760px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 0;
    overflow: hidden auto;
    border: none;
    border-radius: 22px;
    background:
      radial-gradient(120% 90% at 30% 20%, #1d4a35, #123425 55%, #0b2419);
    color: var(--cream);
    font-family: var(--body);
    box-shadow:
      inset 0 0 0 2px #0b2419,
      inset 0 0 0 4px var(--gold),
      0 30px 80px -20px rgb(0 0 0 / 0.7);
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

  .snow {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .snow span {
    position: absolute;
    top: -10px;
    border-radius: 50%;
    background: white;
    filter: blur(0.6px);
    animation: fall linear infinite;
  }

  @keyframes fall {
    to {
      transform: translate(var(--drift), 640px);
    }
  }

  .garland {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 84px;
    pointer-events: none;
    transform-origin: 50% 0;
    animation: swag 1.6s ease-out;
  }

  @keyframes swag {
    30% {
      transform: rotate(0.8deg);
    }
    60% {
      transform: rotate(-0.5deg);
    }
  }

  .holly {
    position: absolute;
    bottom: 6px;
    width: 90px;
    pointer-events: none;
  }

  .holly.left {
    left: 6px;
  }

  .holly.right {
    right: 6px;
    transform: scaleX(-1);
  }

  .close {
    position: absolute;
    top: 14px;
    right: 16px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    padding: 0 0 3px;
    border: 1.5px solid var(--gold);
    border-radius: 50%;
    background: #0f2c20;
    color: var(--gold);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover,
  .step:hover {
    background: var(--gold);
    color: #0f2c20;
  }

  .close:focus-visible,
  .step:focus-visible,
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

  .hanger img {
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

  .clipped img {
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

  .step {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0 0 3px;
    border: 1.5px solid var(--gold);
    border-radius: 50%;
    background: transparent;
    color: var(--gold);
    font-size: 26px;
    line-height: 1;
    cursor: pointer;
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
    .garland,
    .hanger,
    .hanger img {
      animation: none;
    }

    .snow {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 58px 20px 4px;
    }

    .hanger img {
      width: min(220px, 70vw);
    }

    .words {
      align-items: center;
      text-align: center;
    }

    .holly {
      width: 64px;
    }
  }
</style>
