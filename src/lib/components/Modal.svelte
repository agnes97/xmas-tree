<script lang="ts">
  import type { Snippet } from 'svelte';

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
  <div class="content">
    <header>
      <h2 id="modal-title">{title}</h2>
      <button
        type="button"
        class="close"
        aria-label="Close"
        onclick={() => (open = false)}
      >
        ×
      </button>
    </header>

    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    width: min(400px, calc(100vw - 2rem));
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  .content {
    padding: 1.5rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close {
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
  }
</style>
