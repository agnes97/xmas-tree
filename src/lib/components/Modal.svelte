<script lang="ts">
  import type { Snippet } from 'svelte';
  import FestivePanel from './festive/FestivePanel.svelte';
  import GoldButton from './festive/GoldButton.svelte';

  type Props = {
    open: boolean;
    title: string;
    children: Snippet;
  };

  let { open = $bindable(), title, children }: Props = $props();

  function sync(dialog: HTMLDialogElement) {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) open = false;
  }
</script>

<dialog
  {@attach sync}
  onclose={() => (open = false)}
  onclick={onBackdropClick}
  aria-labelledby="modal-title"
>
  <FestivePanel class="content" holly snow={12}>
    <header>
      <h2 id="modal-title">{title}</h2>
      <GoldButton shape="round" aria-label="Close" onclick={() => (open = false)}>×</GoldButton>
    </header>

    <div class="body">
      {@render children()}
    </div>
  </FestivePanel>
</dialog>

<style>
  dialog {
    width: min(420px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 0;
    overflow: hidden auto;
    border: none;
    border-radius: 22px;
    background: var(--pine);
    box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.7);
  }

  dialog[open] {
    animation: drop 0.55s cubic-bezier(0.2, 1.35, 0.4, 1);
  }

  dialog::backdrop {
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

  :global(.panel.content) {
    --fall: 480px;
  }

  :global(.panel.content > .corner) {
    width: 60px;
  }

  header,
  .body {
    position: relative;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 26px 26px 0 32px;
  }

  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    font-size: 30px;
    line-height: 1.1;
    color: var(--cream);
  }

  .body {
    padding: 20px 32px 72px;
  }

  @media (prefers-reduced-motion: reduce) {
    dialog[open],
    dialog::backdrop {
      animation: none;
    }
  }
</style>
