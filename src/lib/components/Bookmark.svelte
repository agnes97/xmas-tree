<script lang="ts">
  import type { Story } from '../tree.svelte';
  import EditableYear from './EditableYear.svelte';

  type Props = {
    story: Story;
    onOpen: () => void;
    onYear: (year: number) => void;
  };

  let { story, onOpen, onYear }: Props = $props();
</script>

<div class="tab" style:--ink={story.color}>
  <button
    type="button"
    class="open"
    aria-label={`${story.name}, ${story.year}. Read its story`}
    onclick={onOpen}
  ></button>

  <div class="year-slot">
    <EditableYear value={story.year} name={story.name} onCommit={onYear} />
  </div>

  <p class="text">
    <span class="name">{story.name}</span>
    <span class="description">{story.description}</span>
  </p>

  <span class="picture" aria-hidden="true">
    {#if story.image}
      <img src={story.image} alt="" />
    {:else}
      <span class="glass"></span>
    {/if}
  </span>
</div>

<style>
  .tab {
    --tint: color-mix(in srgb, var(--ink) 16%, var(--surface));

    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 88%;
    min-height: 84px;
    padding: 8px 6px 8px 18px;
    border: 1px solid color-mix(in srgb, var(--ink) 28%, var(--border));
    border-left: none;
    border-radius: 0 999px 999px 0;
    background:
      linear-gradient(90deg, var(--ink) 0 6px, transparent 6px),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--ink) 10%, var(--surface)),
        var(--tint)
      );
    color: var(--text);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 4px 12px -6px color-mix(in srgb, var(--ink) 50%, transparent);
    transition:
      width 0.35s cubic-bezier(0.3, 1.3, 0.5, 1),
      box-shadow 0.3s,
      transform 0.3s;
  }

  .tab:hover,
  .tab:focus-within {
    width: 100%;
    box-shadow:
      0 2px 4px rgb(0 0 0 / 0.08),
      0 10px 24px -8px color-mix(in srgb, var(--ink) 65%, transparent);
  }

  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: inherit;
    background: none;
    cursor: pointer;
  }

  .open:focus-visible {
    outline: 3px solid var(--ink);
    outline-offset: 2px;
  }

  .year-slot {
    position: relative;
    z-index: 2;
    flex: none;
    color: color-mix(in srgb, var(--ink) 70%, var(--text));
  }

  .text {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--body);
  }

  .name {
    display: block;
    overflow: hidden;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: color-mix(in srgb, var(--ink) 60%, var(--text));
  }

  .description {
    display: -webkit-box;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.35;
    color: var(--text-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .tab:hover .description,
  .tab:focus-within .description {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .picture {
    flex: none;
    display: grid;
    place-items: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
  }

  .picture img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
  }

  .tab:hover .picture img {
    transform: scale(1.12) rotate(-4deg);
  }

  .glass {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, white 70%, var(--ink)),
      var(--ink) 55%,
      color-mix(in srgb, black 35%, var(--ink))
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .tab,
    .tab:hover,
    .tab:focus-within {
      transition: box-shadow 0.3s;
    }

    .tab:hover .picture img {
      transform: none;
    }
  }

  @media (max-width: 760px) {
    .tab,
    .tab:hover,
    .tab:focus-within {
      width: 100%;
      min-height: 76px;
    }
  }
</style>
