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

  const intro = $derived.by(() => {
    if (tree.isEditing) {
      return 'Drag a bauble to move it; it stays on the branches. Save when it looks right.';
    }
    if (tree.layout) {
      return 'Six painted glass baubles, a glass songbird, a frosted heart, an emerald swan, a golden songbird and a ruby songbird hang on the fir. Sweep across the branches to set them turning, or grab one and spin it.';
    }
    if (auth.status === 'unauthenticated') return 'Log in to hang your baubles on the fir.';
    return '';
  });

  const label = $derived(
    tree.isEditing
      ? 'Illustrated Christmas tree in edit mode. Drag a bauble to move it, or press [ and ] to pick one and the arrow keys to move it.'
      : tree.layout
        ? 'Illustrated Christmas tree with six glass baubles, a glass songbird, a frosted heart, and a clip-on glass swan, golden songbird and ruby songbird with feather tails. Left and right arrow keys spin them, up and down swing them.'
        : 'Illustrated Christmas tree, bare until you log in.'
  );
</script>

<section class="fir">
  <div class="bar">
    <p>{intro}</p>
  </div>

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

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 40px;
    padding: 22px max(24px, env(safe-area-inset-right, 0px)) 4px
      max(24px, env(safe-area-inset-left, 0px));
  }

  .bar p {
    min-height: 1lh;
    margin: 0;
    max-width: 46ch;
    font-size: 15px;
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

  @media (max-width: 560px) {
    .bar {
      padding: 16px max(16px, env(safe-area-inset-right, 0px)) 0
        max(16px, env(safe-area-inset-left, 0px));
    }

    .bar p {
      font-size: 14px;
    }
  }
</style>
