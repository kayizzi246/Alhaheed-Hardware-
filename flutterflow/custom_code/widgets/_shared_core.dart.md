# The shared core

Everything in this file is repeated, **identically**, at the top of all four
screen files. That is deliberate, not an oversight.

FlutterFlow generates `custom_code/widgets/index.dart` as a list of

```dart
export 'al_hadeed_shop.dart' show AlHadeedShop;
```

lines, so a **widget class is the only thing that crosses from one custom
widget file to another**. A shared private helper is simply not visible from
the next file, and the build fails with `The function '_txt' isn't defined`.

So: when you change a token, a helper or the API base, change it in all four
files. They are listed here once so you can diff them.

- `_apiBase` — the one line to change when you deploy
- tokens — `_navy`, `_brand`, `_ink`, type scale, `_liquid`, `_Glass`, `_cardShadow` (soft layered card depth), `_heroGradient` (the brand blue for hero cards, the header and the add button)
- `_Pressable`, `_Skeleton`, `_Field`, `_Chip`, `_Sheet`, `_Empty`, `_toast`
- `_ApiError`, `_unwrap`, `_apiGet`, `_apiPost`
- `_ugx`, `_shortUgx`, `_statusColours`, `_statusLabel`, `_categoryColour`
- `_Session` — who is signed in, kept in SharedPreferences
- `_CartStore` — the cart, kept on the phone
- `_Header`, `_BottomBar` — the chrome every screen wears

This file is documentation. It is not Dart and FlutterFlow never sees it.
