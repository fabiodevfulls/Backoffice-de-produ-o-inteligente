import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../app/", import.meta.url);
const dashboardCss = await readFile(new URL("globals.css", root), "utf8");
const loginCss = await readFile(new URL("login/styles.module.css", root), "utf8");
const dashboardSource = await readFile(new URL("dashboard.tsx", root), "utf8");

function cssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `CSS rule ${selector} exists`);
  return match[1];
}

test("supervisor report attendants render as a readable single-column list", () => {
  const list = cssRule(dashboardCss, ".report-attendant-menu");
  const option = cssRule(dashboardCss, ".report-filters .report-attendant-option");
  const name = cssRule(dashboardCss, ".report-attendant-option span");

  assert.match(list, /grid-template-columns:\s*1fr/);
  assert.match(option, /font-weight:\s*400/);
  assert.match(name, /white-space:\s*normal/);
  assert.doesNotMatch(name, /text-overflow:\s*ellipsis/);
});

test("login title and description keep normal spacing without negative margins", () => {
  const description = cssRule(loginCss, ".card p");

  assert.match(description, /margin:\s*0(?:\s|;)/);
  assert.doesNotMatch(description, /margin:\s*-[\d.]+px/);
});

test("supervisor attendant selection stays collapsed until opened and supports multiple checkboxes", () => {
  assert.match(dashboardSource, /<details className="report-attendant-dropdown">/);
  assert.match(dashboardSource, /<summary className="report-attendant-trigger">/);
  assert.match(dashboardSource, /report-attendant-menu/);
  assert.match(dashboardSource, /type="checkbox" checked=\{checked\} onChange=\{\(\) => toggleAttendant/);
});

test("attendant option menu floats over the report layout like a dropdown", () => {
  const dropdown = cssRule(dashboardCss, ".report-attendant-dropdown");
  const openDropdown = cssRule(dashboardCss, ".report-attendant-dropdown[open]");
  const menu = cssRule(dashboardCss, ".report-attendant-menu");

  assert.match(dropdown, /position:\s*relative/);
  assert.match(openDropdown, /z-index:/);
  assert.match(menu, /position:\s*absolute/);
});
