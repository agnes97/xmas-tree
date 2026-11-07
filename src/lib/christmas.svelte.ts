import { createSubscriber } from 'svelte/reactivity';

export type Countdown =
  | { merry: true }
  | { merry: false; days: number; hours: number; minutes: number; seconds: number };

/** Time left until Christmas Eve; from the 24th to the 26th of December it is Christmas. */
export function untilChristmasEve(now: Date): Countdown {
  const year = now.getFullYear();
  const eve = new Date(year, 11, 24);
  const after = new Date(year, 11, 27);
  if (now >= eve && now < after) return { merry: true };

  const target = now >= after ? new Date(year + 1, 11, 24) : eve;
  let s = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { merry: false, days, hours, minutes, seconds: s - minutes * 60 };
}

/** The time, ticking every second while something reads it. */
class Clock {
  #subscribe = createSubscriber((update) => {
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  });

  get countdown() {
    this.#subscribe();
    return untilChristmasEve(new Date());
  }
}

export const clock = new Clock();
