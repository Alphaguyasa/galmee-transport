# DESIGN.md: Galmee Transport

Change this file first, then the code.

> Transport uses the **Galmee design system**. Tokens live in `src/app/globals.css`
> (only `--trade` and the destination-roll tokens are transport-specific), shared
> components in `src/components/galmee/`. The colour and type tables below are
> superseded by the system; the brief, the destination roll and the wireframes stay.

## Brief

- **Subject:** a bus station office in Shashamane. A window with a paper ticket book, a blue-painted coach outside, a destination roll above the windscreen, a conductor counting notes at dusk.
- **Audience:** the ticket seller at the window (one thumb, a queue in front of them) and the owner (who wants to know, every evening, what each seller and each bus should have handed in).
- **Primary job:** sell a seat in a few taps, then reconcile the cash at the end of the day.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| `--livery` | `#1B3A78` | Dominant. Coach paint: header bar, primary action. White on it is 10.5:1. |
| `--yard` | `#F2F3F6` | Page background. |
| `--ink` | `#14171F` | Text. |
| `--rule` | `#D4D8E1` | Borders and hairlines. |
| `--roll` on `--roll-ground` | `#FFB81C` on `#15171D` | The destination roll. Amber on near-black, 11:1. Used only for route names on the board. |
| `--short` | `#B42318` | Cash short, errors. 6.6:1 on white. |

Status is never colour alone: seat and handover states carry a word or an icon. A shortfall always says "short" beside the figure.

## Type

- **Archivo Narrow** (English and Afaan Oromo): condensed like a destination roll, so "Shashamane to Addis Ababa" fits one line at 360 px. Numbers use tabular figures (`.num`).
- **Noto Sans Ethiopic** for Amharic, 400/600.
- Self-hosted with `next/font/local`.
- Scale: 14 / 16 / 20 / 24; the destination roll is 24 bold.

## Layout (360 px first)

```
+----------------------------+
| Company name     [lang][x] |  livery header
+----------------------------+
| SHASHAMANE > HAWASSA       |  amber on black roll, the one bold thing
| 08:30   Bus 4   31/45 sold |
+----------------------------+
| Seat grid: tap a free seat |
| [1][2]  [3][4]             |
| Passenger phone [        ] |
+----------------------------+
|        [ Sell ticket ]     |  sticky above tab bar
+----------------------------+
| Sell  Board  Cash  Parcels |
+----------------------------+
```

Desktop: sidebar left, seat grid and sale form side by side, max 64 rem wide.

## The one bold thing

The destination roll. Every route title on screen is set like the roll above a windscreen: amber condensed type on near-black, hard edge, small radius. Everything else stays flat and quiet: hairline rules, no shadows, 6 px corners.

## Reviewed against generic defaults

Not cream and terracotta, not black and acid green, no gradient washes, no ALL-CAPS eyebrows, no identical soft-shadow cards. The amber appears only on the roll so it keeps meaning.
