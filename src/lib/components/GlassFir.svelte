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
    return () => {
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

  <p class="visually-hidden" aria-live="polite">{tree.isEditing ? announcement : ''}</p>
</section>

<style>
  .fir {
    --snow: #e8efe9;

    flex: 1;
    display: flex;
    flex-direction: column;
    font-family: var(--body);
  }

  @media (prefers-color-scheme: dark) {
    .fir {
      --snow: #16282b;
    }
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 420px;
    touch-action: none;
    outline: none;
    cursor: default;
  }

  .stage.editing {
    outline: 2px dashed color-mix(in srgb, var(--title) 55%, transparent);
    outline-offset: -12px;
    border-radius: 24px;
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
