<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { auth } from '../auth.svelte';
  import { tree } from '../tree.svelte';
  import { mountGlassFir, type GlassFir } from '../tree/glassFir';

  let fir = $state.raw<GlassFir>();
  let announcement = $state('');

  const attach: Attachment<HTMLElement> = (stage) => {
    const handle = mountGlassFir(stage, {
      onMove: (id, position) => tree.move(id, position),
      onPick: (label) => (announcement = label),
    });
    fir = handle;
    tree.view = handle.view;
    return () => {
      tree.view = null;
      handle.destroy();
      fir = undefined;
    };
  };

  $effect(() => fir?.setLayout(tree.layout));
  $effect(() => fir?.setEditing(tree.isEditing));

  // Once the baubles hang, take their pictures for the bookmarks; the models never change, so once is enough.
  $effect(() => {
    const handle = fir;
    if (!handle || !tree.layout || Object.keys(tree.images).length) return;
    const raf = requestAnimationFrame(() => {
      const pictures = handle.snapshots();
      if (Object.keys(pictures).length) tree.images = pictures;
    });
    return () => cancelAnimationFrame(raf);
  });

  // A hovered bookmark sets its ornament swinging.
  $effect(() => {
    if (tree.hovered) fir?.nudge(tree.hovered);
  });

  const label = $derived(
    tree.isEditing
      ? 'Illustrated Christmas tree in edit mode. Drag a bauble to move it, or press [ and ] to pick one and the arrow keys to move it.'
      : tree.layout
        ? 'Illustrated Christmas tree with a snowflake topper, four glass baubles, a glass songbird, a frosted heart, a plum glitter snowflake, and a clip-on glass swan, golden songbird and ruby songbird with feather tails. Left and right arrow keys spin them, up and down swing them.'
        : 'Illustrated Christmas tree, bare until you log in.'
  );
</script>

<section class="fir">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    {@attach attach}
    class={['stage', tree.isEditing && 'editing']}
    role="img"
    tabindex="0"
    aria-label={label}
  ></div>

  {#if tree.isEditing}
    <p class="hint" aria-hidden="true">Drag a bauble to move it</p>
  {/if}
  <p class="visually-hidden" aria-live="polite">{tree.isEditing ? announcement : ''}</p>
</section>

<style>
  .fir {
    /* The snow the tree stands in, read by the canvas. */
    --snow: #24392e;

    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    /* Grows up behind the header, as far as App measured room for. */
    margin-top: calc(-1 * var(--lift, 0px));
    font-family: var(--body);
  }

  /* A soft glow behind the tree. */
  .fir::before {
    content: '';
    position: absolute;
    inset: calc(var(--lift, 0px) + 6%) 10% 6%;
    background: radial-gradient(closest-side, var(--halo), transparent);
    pointer-events: none;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    touch-action: none;
    outline: none;
    cursor: default;
  }

  /* The edit frame stays below the header. */
  .stage.editing::after {
    content: '';
    position: absolute;
    inset: calc(var(--lift, 0px) + 10px) 10px 10px;
    border: 2px dashed color-mix(in srgb, var(--title) 55%, transparent);
    border-radius: 24px;
    pointer-events: none;
  }

  /* Inside the edit frame's corner, where it never crowds the header or the tree. */
  .hint {
    position: absolute;
    top: calc(var(--lift, 0px) + 22px);
    left: 26px;
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .stage:focus-visible {
    box-shadow: inset 0 0 0 3px var(--title);
  }

  .stage :global(canvas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
