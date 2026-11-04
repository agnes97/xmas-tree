<script lang="ts">
  import { auth } from '../auth.svelte';
  import { tree } from '../tree.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();
</script>

<header>
  <h1>Xmas Tree</h1>

  {#if auth.isAuthenticated && auth.user}
    <div class="user">
      {#if tree.isEditing}
        {#if tree.error}
          <span class="error" role="alert">{tree.error}</span>
        {/if}
        <button
          type="button"
          class="primary"
          disabled={!tree.isDirty || tree.status === 'saving'}
          onclick={() => tree.save()}
        >
          {tree.status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={tree.status === 'saving'} onclick={() => tree.discard()}>
          Discard
        </button>
      {:else}
        <span>Logged in as <strong>{auth.user.name}</strong></span>
        <button type="button" disabled={tree.status !== 'ready'} onclick={() => tree.edit()}>
          Edit
        </button>
        <button type="button" onclick={() => auth.logout()}>Logout</button>
      {/if}
    </div>
  {:else if auth.status === 'unauthenticated'}
    <button type="button" onclick={onLoginClick}>Login</button>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(28px, 3.4vw, 44px);
    line-height: 1;
    letter-spacing: -0.01em;
    color: var(--title);
  }

  .user {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem 1rem;
  }

  .error {
    color: var(--danger);
    font-size: 0.875rem;
  }

  strong {
    color: var(--accent);
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: transparent;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  button:hover:not(:disabled),
  button.primary:not(:disabled) {
    background: var(--accent);
    color: var(--on-accent);
  }

  button.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
