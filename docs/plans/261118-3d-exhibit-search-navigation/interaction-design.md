# Interaction design

Inherit Aura limestone/walnut/bronze HUD with Mantine controls. Compact search disclosure near room/catalogue controls. Expanded results scroll in a bounded panel; search and catalogue are mutually exclusive. Mobile disclosure closes on successful arrival to make room for detail; focus returns to the opener. Desktop also uses this policy consistently. A short status remains readable when collapsed.

Search opens only on explicit action (no automatic mobile keyboard). Semantic list and buttons, labelled input, clear button, result count live region, Enter invokes first navigable result; Tab reaches every action. No listbox role or invented arrow interaction. Escape closes search before story/detail/tour; native fullscreen Escape remains browser-owned.

Match rings use static primitive geometry outside GLB, target uses a stronger broken ring. Minimap adds outline for match and double outline for target, distinct from selected fill. Clear query removes match outlines. No per-frame search, GLB cloning or postprocessing.

English and Vietnamese defaults with public translation keys. Other locales fall back to English for new controls. 2D links remain available for outside-room or blocked exhibits. HTML search is hidden while XR or WebGL recovery owns presentation.
