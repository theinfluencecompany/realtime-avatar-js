# realtime-avatar-react

**Not released.** This package is extracted but not yet publishable — it has no `exports`,
`main` or `types` in its `package.json`, and it is not part of the workspace build.

The React facade for joining a call from the browser: `AvatarCall` and `useAvatarCall`. You
hand it the connection payload your server got from
[`realtime-avatar`](../http-client), and it renders her.

Until this ships, join a call with `livekit-client` directly — see
[`apps/demo/coding-companion`](../../apps/demo/coding-companion) for the whole path in one
file, and [`libs/tools`](../tools) for letting her call your functions mid-conversation.

## Before releasing this

Read [BOUNDARY.md](../../BOUNDARY.md) first. In short:

1. Add `exports` / `types` and put the package in the build.
2. Ship the **facade only**. It currently re-exports LiveKit types, which would make the
   transport part of our public contract.
3. Write this README for customers. What was here was a verbatim copy of the internal
   package's README, describing platform internals; it was deleted rather than edited,
   because trimming a leaked document tends to leave behind the half you did not notice.
4. Run `npm run boundary` against the built output before the first publish, not after.
