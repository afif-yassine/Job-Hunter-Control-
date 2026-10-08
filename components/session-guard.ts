/**
 * The browser shares its session cookies between windows: if another account signs in elsewhere, an
 * already open page keeps showing the old account while every request it sends is made as the new one
 * (a CV was imported into the wrong account that way). The page is therefore reloaded on the account it
 * now acts as. The decision is kept pure so it can be tested.
 */

/**
 * Should the page reload?
 * - `startedAs`: the id of the account the page was rendered for (known by the server, not read later).
 * - `nowUserId`: the id of the session the browser holds now (null: none, or not known).
 * It reloads on a sign-out, or when the session now belongs to ANOTHER account, whatever the event.
 * It never reloads for the same account (token refresh, initial event, user update), nor when it cannot
 * compare, nor on a missing session that no sign-out announced (a transient state).
 */
export function shouldReload(input: { event: string; startedAs: string | null; nowUserId: string | null }): boolean {
  if (!input.startedAs) return false;
  if (input.event === "SIGNED_OUT") return true;
  return Boolean(input.nowUserId) && input.nowUserId !== input.startedAs;
}
