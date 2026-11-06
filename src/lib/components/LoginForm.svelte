<script lang="ts">
  import { auth } from '../auth.svelte';
  import GoldButton from './festive/GoldButton.svelte';

  type Props = {
    onSuccess: () => void;
  };

  let { onSuccess }: Props = $props();

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);

  const isEmailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const isPasswordValid = $derived(password.length >= 8);
  const isValid = $derived(isEmailValid && isPasswordValid);

  async function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isValid) return;

    isSubmitting = true;

    try {
      await auth.login({ email, password });
      password = '';
      onSuccess();
    } catch {
      // auth.error holds the message
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form {onsubmit} novalidate>
  <label>
    <span>Email</span>
    <input type="email" autocomplete="email" bind:value={email} required />
    {#if email && !isEmailValid}
      <small>Must be an email</small>
    {/if}
  </label>

  <label>
    <span>Password</span>
    <input
      type="password"
      autocomplete="current-password"
      bind:value={password}
      required
    />
    {#if password && !isPasswordValid}
      <small>Must be at least 8 characters</small>
    {/if}
  </label>

  {#if auth.error}
    <p class="error" role="alert">{auth.error}</p>
  {/if}

  <GoldButton type="submit" primary class="submit" disabled={!isValid || isSubmitting}>
    {isSubmitting ? 'Logging in…' : 'Login'}
  </GoldButton>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  span {
    font-size: 13px;
    font-weight: 500;
    font-variant: small-caps;
    letter-spacing: 0.12em;
    color: var(--gold);
  }

  input {
    padding: 0.6rem 0.85rem;
    border: 1.5px solid transparent;
    border-radius: 10px;
    background: var(--cream);
    color: #3b2a1a;
    font: inherit;
    font-size: 16px;
  }

  input:focus-visible {
    border-color: var(--gold);
    outline: 3px solid color-mix(in srgb, var(--gold) 45%, transparent);
    outline-offset: 1px;
  }

  small,
  .error {
    color: var(--festive-danger);
    font-size: 0.8125rem;
  }

  .error {
    margin: 0;
  }

  form :global(.submit) {
    margin-top: 0.5rem;
    padding: 0.75rem;
  }
</style>
