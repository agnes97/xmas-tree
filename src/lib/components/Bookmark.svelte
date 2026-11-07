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

<div class="card" style:--c={story.color}>
  <button
    type="button"
    class="open"
    aria-label={`${story.name}, ${story.year}. Read its story`}
    onclick={onOpen}
  ></button>

  <span class="orb" aria-hidden="true">
    {#if story.image}
      <img src={story.image} alt="" />
    {:else}
      <span class="glass"></span>
    {/if}
  </span>

  <span class="name" aria-hidden="true">{story.name}</span>

  <span class="year-slot">
    <EditableYear value={story.year} name={story.name} size="card" onCommit={onYear} />
  </span>

  <span class="desc" aria-hidden="true">{story.description}</span>
</div>

<style>
  /* A card in the popups' look; it shows more of the decoration the more room it gets. */
  .card {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
    gap: 0 10px;
    width: 100%;
    height: 100%;
    padding: 0 8px 0 20px;
    overflow: hidden;
    border-radius: 14px;
    background:
      radial-gradient(110% 130% at 92% 0%, color-mix(in srgb, var(--c) 34%, transparent), transparent 62%),
      radial-gradient(120% 90% at 30% 20%, var(--pine-light), var(--pine) 55%, var(--pine-deep));
    color: var(--cream);
    box-shadow:
      inset 0 0 0 1.5px var(--pine-deep),
      inset 0 0 0 3px color-mix(in srgb, var(--gold) 55%, transparent);
    transition:
      box-shadow 0.25s,
      translate 0.3s var(--ease-out);
  }

  .card:hover,
  .card:has(.open:focus-visible) {
    translate: 0 -2px;
    box-shadow:
      inset 0 0 0 1.5px var(--pine-deep),
      inset 0 0 0 3px var(--gold),
      0 14px 26px -16px rgb(0 0 0 / 0.8);
  }

  .card:has(.open:focus-visible) {
    box-shadow:
      inset 0 0 0 1.5px var(--pine-deep),
      inset 0 0 0 3px var(--gold),
      0 0 0 3px var(--cream);
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
    outline: none;
  }

  .orb {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    transition: transform 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
  }

  .card:hover .orb {
    transform: scale(1.1) rotate(-6deg);
  }

  .orb img {
    width: 140%;
    height: 140%;
    object-fit: contain;
    filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.5));
  }

  .glass {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(
      circle at 34% 30%,
      color-mix(in srgb, #fff 70%, var(--c)),
      var(--c) 55%,
      color-mix(in srgb, #000 35%, var(--c))
    );
    box-shadow: 0 6px 14px -6px rgb(0 0 0 / 0.7);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .year-slot {
    position: relative;
    z-index: 2;
    color: var(--gold-bright);
  }

  .desc {
    display: none;
  }

  /* Medium card: a bigger glass, the year above the name, so the name has the width for two lines. */
  @container card (min-height: 58px) {
    .card {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-rows: auto auto;
      align-content: center;
      row-gap: 1px;
    }

    .orb {
      grid-row: 1 / span 2;
      width: 34px;
      height: 34px;
    }

    .year-slot {
      grid-row: 1;
      grid-column: 2;
      justify-self: start;
      /* the year's pill padding, so its digits line up with the name */
      margin-left: calc(-0.42em - 1.5px);
    }

    .name {
      grid-row: 2;
      grid-column: 2;
      display: -webkit-box;
      white-space: normal;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
  }

  /* Tall card: the glass and year on top, the name below, the story's opening when there is room. */
  @container card (min-height: 100px) and (min-width: 130px) {
    .card {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-items: start;
      padding: 12px 10px 13px 20px;
    }

    .orb {
      grid-row: 1;
      width: 40px;
      height: 40px;
    }

    .year-slot {
      grid-row: 1;
      grid-column: 2;
      justify-self: end;
      margin-left: 0;
      --year-size: 19px;
    }

    .name {
      grid-row: 2;
      grid-column: 1 / -1;
      align-self: end;
      padding-right: 4px;
      font-size: 15px;
    }
  }

  @container card (min-height: 150px) and (min-width: 170px) {
    .desc {
      grid-row: 3;
      grid-column: 1 / -1;
      display: -webkit-box;
      margin-top: 4px;
      padding-right: 4px;
      overflow: hidden;
      font-size: 13px;
      line-height: 1.4;
      color: color-mix(in srgb, var(--cream) 72%, transparent);
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .orb {
      transition: none;
    }
  }
</style>
