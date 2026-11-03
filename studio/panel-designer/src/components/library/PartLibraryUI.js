function PartIcon({ def }) {
  const cat = def.category ?? inferCategoryForType(def.type);
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (cat === "fader" || isFaderLike(def)) {
    return React.createElement(
      "svg",
      { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      React.createElement("rect", {
        x: "9",
        y: "3",
        width: "6",
        height: "18",
        rx: "3",
        ...common,
      }),
      React.createElement("rect", {
        x: "6",
        y: "10",
        width: "12",
        height: "5",
        rx: "1.5",
        fill: "currentColor",
        opacity: ".75",
      }),
    );
  }
  if (cat === "potentiometer" || cat === "encoder" || isPotLike(def)) {
    return React.createElement(
      "svg",
      { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      React.createElement("circle", { cx: "12", cy: "12", r: "8", ...common }),
      React.createElement("path", { d: "M12 12V5", ...common }),
      React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3",
        fill: "currentColor",
        opacity: ".20",
      }),
    );
  }
  if (cat === "jack" || isJackLike(def)) {
    return React.createElement(
      "svg",
      { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      React.createElement("circle", { cx: "12", cy: "12", r: "8", ...common }),
      React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3.4",
        fill: "currentColor",
        opacity: ".7",
      }),
      React.createElement("path", { d: "M5 19l4-4", ...common }),
    );
  }
  if (cat === "switch" || isButtonLike(def)) {
    if (def.type === "slideSwitch8pos") {
      return React.createElement(
        "svg",
        { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("rect", {
          x: "3",
          y: "9",
          width: "18",
          height: "6",
          rx: "1.5",
          ...common,
        }),
        React.createElement("rect", {
          x: "4",
          y: "9.4",
          width: "5.2",
          height: "5.2",
          rx: ".6",
          fill: "currentColor",
          opacity: ".7",
        }),
        React.createElement("path", { d: "M11 11h7M11 13h7", ...common }),
      );
    }
    if (def.type === "slideSwitchMini") {
      return React.createElement(
        "svg",
        { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("rect", {
          x: "4",
          y: "8",
          width: "16",
          height: "8",
          rx: "2",
          ...common,
        }),
        React.createElement("rect", {
          x: "11",
          y: "9.5",
          width: "5.5",
          height: "5",
          rx: "1",
          fill: "currentColor",
          opacity: ".7",
        }),
      );
    }
    if (isJoystick(def)) {
      return React.createElement(
        "svg",
        { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("circle", {
          cx: "12",
          cy: "12",
          r: "7.5",
          ...common,
        }),
        React.createElement("circle", {
          cx: "12",
          cy: "12",
          r: "5.1",
          ...common,
          strokeWidth: "1.3",
        }),
        React.createElement("circle", {
          cx: "12",
          cy: "12",
          r: "2.8",
          ...common,
          strokeWidth: "1.0",
        }),
        React.createElement("circle", {
          cx: "12",
          cy: "12",
          r: "1.3",
          fill: "currentColor",
          opacity: ".55",
        }),
        React.createElement("circle", {
          cx: "17.8",
          cy: "6.2",
          r: ".82",
          fill: "currentColor",
          opacity: ".55",
        }),
        React.createElement("circle", {
          cx: "6.2",
          cy: "6.2",
          r: ".82",
          fill: "currentColor",
          opacity: ".55",
        }),
        React.createElement("circle", {
          cx: "6.2",
          cy: "17.8",
          r: ".82",
          fill: "currentColor",
          opacity: ".55",
        }),
        React.createElement("circle", {
          cx: "17.8",
          cy: "17.8",
          r: ".82",
          fill: "currentColor",
          opacity: ".55",
        }),
      );
    }
    if (
      def.type === "toggle" ||
      def.type === "toggleSpdt" ||
      def.type === "toggle2m"
    ) {
      return React.createElement(
        "svg",
        { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("circle", {
          cx: "12",
          cy: "15",
          r: "5.8",
          ...common,
        }),
        React.createElement("rect", {
          x: "10",
          y: "3.5",
          width: "4",
          height: "12",
          rx: "2",
          fill: "currentColor",
          opacity: ".75",
        }),
        React.createElement("circle", {
          cx: "12",
          cy: "15",
          r: "2.2",
          fill: "currentColor",
          opacity: ".22",
        }),
      );
    }
    return React.createElement(
      "svg",
      { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      React.createElement("circle", { cx: "12", cy: "12", r: "7", ...common }),
      React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "4",
        fill: "currentColor",
        opacity: ".55",
      }),
    );
  }
  if (cat === "led" || isLedLike(def)) {
    return React.createElement(
      "svg",
      { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "6",
        fill: "currentColor",
        opacity: ".55",
      }),
      React.createElement("path", {
        d: "M17 7l3-3M19 11l3-1M7 17l-3 3",
        ...common,
      }),
    );
  }
  return React.createElement(
    "svg",
    { className: "part-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
    React.createElement("rect", {
      x: "6",
      y: "6",
      width: "12",
      height: "12",
      rx: "2",
      ...common,
    }),
    React.createElement("path", { d: "M9 12h6M12 9v6", ...common }),
  );
}
function PartPickerLabel({ def }) {
  return React.createElement(
    "span",
    { className: "part-picker-label" },
    React.createElement(PartIcon, { def: def }),
    React.createElement("span", null, shortPartName(def)),
  );
}
function LibraryPartPreview({ def }) {
  const placed = {
    ...sanitizePart(def),
    id: `preview-${def.type}-${def.name}`,
    ref: "",
    label: "",
    x: 18,
    y: 18,
    rotation: 0,
    notes: "",
    locked: false,
  };
  const b = getFrontBounds(placed);
  const maxDim = Math.max(
    b.w || placed.frontDiameter || placed.holeDiameter || 6,
    b.h || placed.frontDiameter || placed.holeDiameter || 6,
    placed.slotLength || 0,
    placed.knobDiameter || 0,
    8,
  );
  const pad = Math.max(5, maxDim * 0.26);
  const size = Math.max(24, maxDim + pad * 2);
  const cx = size / 2;
  const cy = size / 2;
  const c = { ...placed, x: cx, y: cy };
  return React.createElement(
    "svg",
    {
      className: "library-real-preview",
      viewBox: `0 0 ${size} ${size}`,
      "aria-hidden": "true",
    },
    React.createElement(
      "defs",
      null,
      React.createElement(
        "radialGradient",
        { id: `lib-glow-${def.type}`, cx: "38%", cy: "30%", r: "70%" },
        React.createElement("stop", {
          offset: "0%",
          stopColor: "rgba(255,255,255,.28)",
        }),
        React.createElement("stop", {
          offset: "48%",
          stopColor: "rgba(201,154,74,.08)",
        }),
        React.createElement("stop", {
          offset: "100%",
          stopColor: "rgba(0,0,0,0)",
        }),
      ),
    ),
    React.createElement("rect", {
      x: "0",
      y: "0",
      width: size,
      height: size,
      rx: size * 0.18,
      fill: "rgba(255,255,255,.025)",
    }),
    React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: size * 0.42,
      fill: `url(#lib-glow-${def.type})`,
    }),
    isFaderLike(c)
      ? React.createElement(
          "g",
          { transform: `rotate(${c.rotation}, ${cx}, ${cy})` },
          React.createElement("rect", {
            x: cx - (c.holeDiameter || 3) / 2,
            y: cy - (c.slotLength || 20) / 2,
            width: c.holeDiameter || 3,
            height: c.slotLength || 20,
            rx: (c.holeDiameter || 3) / 2,
            fill: "#050505",
            stroke: "rgba(255,255,255,.45)",
            strokeWidth: ".35",
          }),
          React.createElement("rect", {
            x: cx - Math.max(7, c.faderHandleW || 8) / 2,
            y: cy - (c.faderHandleH || 5) / 2,
            width: Math.max(7, c.faderHandleW || 8),
            height: c.faderHandleH || 5,
            rx: "1.4",
            fill: c.type === "fader20led" ? "#ff3838" : "#dfe4e8",
            stroke: "rgba(0,0,0,.72)",
            strokeWidth: ".32",
          }),
          c.type === "fader20led" &&
            React.createElement("rect", {
              x: cx - 1.5,
              y: cy - 1.0,
              width: "3",
              height: "1.5",
              rx: ".35",
              fill: "rgba(255,255,255,.35)",
            }),
        )
      : isJackLike(c)
        ? React.createElement(
            "g",
            null,
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: Math.max(4, c.frontDiameter * 0.44),
              fill: "#1a1d20",
              stroke: "#050505",
              strokeWidth: ".32",
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: Math.max(2.7, c.frontDiameter * 0.3),
              fill: "#8e969c",
              stroke: "rgba(255,255,255,.20)",
              strokeWidth: ".12",
            }),
            React.createElement("circle", {
              cx: cx,
              cy: cy,
              r: Math.max(2.0, c.holeDiameter * 0.32),
              fill: "#050505",
              stroke: "rgba(255,255,255,.25)",
              strokeWidth: ".16",
            }),
            React.createElement("circle", {
              cx: cx - 1.2,
              cy: cy - 1.2,
              r: Math.max(0.65, c.frontDiameter * 0.055),
              fill: "rgba(255,255,255,.34)",
            }),
          )
        : isPotLike(c) || c.category === "encoder"
          ? React.createElement(
              "g",
              null,
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: Math.max(5, visualKnobDiameter(c) / 2),
                fill: "#101010",
                stroke: "none",
                strokeWidth: "0",
              }),
              React.createElement("circle", {
                cx: cx,
                cy: cy,
                r: Math.max(4, visualKnobDiameter(c) * 0.38),
                fill: "#1d1d1d",
                stroke: "rgba(255,255,255,.18)",
                strokeWidth: ".25",
              }),
              React.createElement("line", {
                x1: cx,
                y1: cy,
                x2: cx,
                y2: cy - Math.max(3.5, visualKnobDiameter(c) * 0.32),
                stroke: "#f2f2ee",
                strokeWidth: ".85",
                strokeLinecap: "round",
              }),
            )
          : isMiniSlideSwitch(c)
            ? React.createElement(
                "g",
                null,
                c.type === "slideSwitch8pos"
                  ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement("rect", {
                        x: cx - 9.8,
                        y: cy - 2.2,
                        width: "19.6",
                        height: "4.4",
                        rx: ".75",
                        fill: "#020202",
                        stroke: "rgba(255,255,255,.35)",
                        strokeWidth: ".22",
                      }),
                      React.createElement("rect", {
                        x: cx - 8.8,
                        y: cy - 3.6,
                        width: "5.8",
                        height: "7.2",
                        rx: ".8",
                        fill: "#20272c",
                        stroke: "rgba(255,255,255,.28)",
                        strokeWidth: ".18",
                      }),
                      Array.from({ length: 4 }, (_, i) =>
                        React.createElement("line", {
                          key: i,
                          x1: cx - 7.8 + i * 1.1,
                          x2: cx - 7.8 + i * 1.1,
                          y1: cy - 2.3,
                          y2: cy + 2.3,
                          stroke: "#050505",
                          strokeWidth: ".32",
                          strokeLinecap: "round",
                        }),
                      ),
                    )
                  : React.createElement(
                      React.Fragment,
                      null,
                      React.createElement("rect", {
                        x: cx - 5.2,
                        y: cy - 2.0,
                        width: "10.4",
                        height: "4.0",
                        rx: ".65",
                        fill: "#020202",
                        stroke: "rgba(255,255,255,.34)",
                        strokeWidth: ".22",
                      }),
                      React.createElement("rect", {
                        x: cx - 4.3,
                        y: cy - 3.1,
                        width: "3.5",
                        height: "6.2",
                        rx: ".55",
                        fill: "#151a1f",
                        stroke: "rgba(255,255,255,.28)",
                        strokeWidth: ".18",
                      }),
                      Array.from({ length: 3 }, (_, i) =>
                        React.createElement("line", {
                          key: i,
                          x1: cx - 3.65 + i * 0.75,
                          x2: cx - 3.65 + i * 0.75,
                          y1: cy - 2.0,
                          y2: cy + 2.0,
                          stroke: "#030303",
                          strokeWidth: ".20",
                          strokeLinecap: "round",
                        }),
                      ),
                    ),
              )
            : c.type === "tact6mm"
              ? React.createElement(
                  "g",
                  null,
                  React.createElement("circle", {
                    cx: cx,
                    cy: cy,
                    r: 2.55,
                    fill: "rgba(0,0,0,.45)",
                    stroke: "rgba(255,255,255,.18)",
                    strokeWidth: ".18",
                  }),
                  React.createElement("circle", {
                    cx: cx,
                    cy: cy,
                    r: 1.75,
                    fill: topColor(c),
                    stroke: "rgba(255,255,255,.45)",
                    strokeWidth: ".16",
                  }),
                  React.createElement("circle", {
                    cx: cx - 0.42,
                    cy: cy - 0.52,
                    r: ".46",
                    fill: "rgba(255,255,255,.42)",
                  }),
                )
              : isButtonLike(c) || isLedLike(c)
                ? React.createElement(
                    "g",
                    null,
                    React.createElement("circle", {
                      cx: cx,
                      cy: cy,
                      r: Math.max(3, c.frontDiameter / 2),
                      fill: isLedLike(c) ? "#ff4141" : "#777",
                      stroke: "rgba(255,255,255,.55)",
                      strokeWidth: ".35",
                    }),
                    React.createElement("circle", {
                      cx: cx - 1.2,
                      cy: cy - 1.4,
                      r: Math.max(0.9, c.frontDiameter * 0.16),
                      fill: "rgba(255,255,255,.5)",
                    }),
                  )
                : c.type === "dip8socket"
                  ? React.createElement(
                      "g",
                      null,
                      React.createElement("rect", {
                        x: cx - 6.4,
                        y: cy - 6.4,
                        width: "12.8",
                        height: "12.8",
                        rx: "1.0",
                        fill: "#090a0c",
                        stroke: "rgba(235,245,248,.70)",
                        strokeWidth: ".28",
                      }),
                      React.createElement("rect", {
                        x: cx - 3.2,
                        y: cy - 3.2,
                        width: "6.4",
                        height: "6.4",
                        rx: ".35",
                        fill: "#050607",
                        stroke: "rgba(185,246,255,.24)",
                        strokeWidth: ".16",
                      }),
                      dip8SocketHoleCenters({ ...c, x: cx, y: cy }).map(
                        (p, i) =>
                          React.createElement("circle", {
                            key: `dip8-prev-${i}`,
                            cx: p.x,
                            cy: p.y,
                            r: ".58",
                            fill: "#b8b0a0",
                            stroke: "#2d261f",
                            strokeWidth: ".13",
                          }),
                      ),
                      React.createElement("path", {
                        d: `M ${cx - 1.3} ${cy - 6.4} A 1.3 1.3 0 0 0 ${cx + 1.3} ${cy - 6.4}`,
                        fill: "none",
                        stroke: "rgba(235,245,248,.70)",
                        strokeWidth: ".22",
                        strokeLinecap: "round",
                      }),
                    )
                  : c.type === "toggle" ||
                      c.type === "toggleSpdt" ||
                      c.type === "toggle2m"
                    ? React.createElement(
                        "g",
                        null,
                        React.createElement("circle", {
                          cx: cx + 0.3,
                          cy: cy + 0.4,
                          r: c.frontDiameter / 2 + 0.35,
                          fill: "rgba(0,0,0,.42)",
                          stroke: "none",
                        }),
                        React.createElement("rect", {
                          x: cx - Math.max(c.holeDiameter * 0.375, 1.25),
                          y: cy - (c.frontDiameter / 2) * 1.28,
                          width: Math.max(c.holeDiameter * 0.75, 2.5),
                          height: (c.frontDiameter / 2) * 1.72,
                          rx: Math.max(c.holeDiameter * 0.375, 1.25),
                          fill: "#1e1e1c",
                          stroke: "#3c3c3a",
                          strokeWidth: ".2",
                        }),
                        c.nutShape === "hex"
                          ? React.createElement("polygon", {
                              points: [0, 60, 120, 180, 240, 300]
                                .map((deg) => {
                                  const a = (deg * Math.PI) / 180;
                                  return `${cx + (c.frontDiameter / 2) * Math.cos(a)},${cy + (c.frontDiameter / 2) * Math.sin(a)}`;
                                })
                                .join(" "),
                              fill: "#86888a",
                              stroke: "rgba(0,0,0,.55)",
                              strokeWidth: ".32",
                            })
                          : React.createElement("circle", {
                              cx,
                              cy,
                              r: c.frontDiameter / 2,
                              fill: "#86888a",
                              stroke: "rgba(0,0,0,.55)",
                              strokeWidth: ".32",
                            }),
                        React.createElement("circle", {
                          cx,
                          cy,
                          r: (c.frontDiameter / 2) * 0.72,
                          fill: "#9ea0a2",
                          stroke: "rgba(0,0,0,.2)",
                          strokeWidth: ".18",
                        }),
                        React.createElement("circle", {
                          cx,
                          cy,
                          r: (c.holeDiameter / 2) * 0.62,
                          fill: "#090b0c",
                          stroke: "rgba(255,255,255,.22)",
                          strokeWidth: ".18",
                        }),
                        React.createElement("ellipse", {
                          cx: cx - (c.frontDiameter / 2) * 0.22,
                          cy: cy - (c.frontDiameter / 2) * 0.26,
                          rx: (c.frontDiameter / 2) * 0.32,
                          ry: (c.frontDiameter / 2) * 0.2,
                          fill: "rgba(255,255,255,.22)",
                          stroke: "none",
                        }),
                      )
                    : isJoystick(c)
                      ? React.createElement(
                          "g",
                          null,
                          React.createElement("circle", {
                            cx: cx + 0.5,
                            cy: cy + 0.5,
                            r: c.frontDiameter / 2 + 0.4,
                            fill: "rgba(0,0,0,.52)",
                            stroke: "none",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: c.frontDiameter / 2,
                            fill: "#1a1c1e",
                            stroke: "none",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: c.frontDiameter / 2,
                            fill: "none",
                            stroke: "rgba(255,255,255,.18)",
                            strokeWidth: ".5",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: c.frontDiameter / 2 - 0.3,
                            fill: "none",
                            stroke: "rgba(0,0,0,.65)",
                            strokeWidth: ".5",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: 14.6,
                            fill: "none",
                            stroke: "rgba(0,0,0,.75)",
                            strokeWidth: "1.2",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: 14.0,
                            fill: "#090b0c",
                            stroke: "none",
                          }),
                          ...[14.0, 12.0, 9.5, 7.5, 5.5, 4.0].flatMap(
                            (r, i) => [
                              React.createElement("circle", {
                                key: `bsh${i}`,
                                cx: cx + 0.22,
                                cy: cy + 0.22,
                                r,
                                fill: "none",
                                stroke: "rgba(0,0,0,.42)",
                                strokeWidth: ".45",
                              }),
                              React.createElement("circle", {
                                key: `brd${i}`,
                                cx,
                                cy,
                                r,
                                fill: "none",
                                stroke: "#050607",
                                strokeWidth: i < 2 ? "1.1" : ".8",
                              }),
                              React.createElement("circle", {
                                key: `brh${i}`,
                                cx,
                                cy,
                                r,
                                fill: "none",
                                stroke: "rgba(255,255,255,.05)",
                                strokeWidth: ".22",
                              }),
                            ],
                          ),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: "4.0",
                            fill: "#060708",
                            stroke: "rgba(0,0,0,.55)",
                            strokeWidth: ".4",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: "3.5",
                            fill: "#111415",
                            stroke: "#282a2c",
                            strokeWidth: ".2",
                          }),
                          React.createElement("ellipse", {
                            cx: cx - 1.1,
                            cy: cy - 1.3,
                            rx: "1.3",
                            ry: ".9",
                            fill: "rgba(255,255,255,.13)",
                            stroke: "none",
                          }),
                          React.createElement("circle", {
                            cx,
                            cy,
                            r: ".65",
                            fill: "#222426",
                            stroke: "rgba(255,255,255,.28)",
                            strokeWidth: ".1",
                          }),
                          ...[
                            [1, 1],
                            [-1, 1],
                            [-1, -1],
                            [1, -1],
                          ].flatMap(([ox, oy], i) => {
                            const sx = cx + ox * 16.25;
                            const sy = cy + oy * 16.25;
                            return [
                              React.createElement("circle", {
                                key: `ssh${i}`,
                                cx: sx,
                                cy: sy,
                                r: "1.55",
                                fill: "#252729",
                                stroke: "#4a4c4f",
                                strokeWidth: ".14",
                              }),
                              React.createElement("line", {
                                key: `sc1${i}`,
                                x1: sx - 0.85,
                                y1: sy,
                                x2: sx + 0.85,
                                y2: sy,
                                stroke: "#0a0b0c",
                                strokeWidth: ".28",
                                strokeLinecap: "round",
                              }),
                              React.createElement("line", {
                                key: `sc2${i}`,
                                x1: sx,
                                y1: sy - 0.85,
                                x2: sx,
                                y2: sy + 0.85,
                                stroke: "#0a0b0c",
                                strokeWidth: ".28",
                                strokeLinecap: "round",
                              }),
                            ];
                          }),
                        )
                      : React.createElement(
                          "g",
                          null,
                          React.createElement("rect", {
                            x: cx - 6,
                            y: cy - 6,
                            width: "12",
                            height: "12",
                            rx: "2",
                            fill: "#151515",
                            stroke: "rgba(185,246,255,.65)",
                            strokeWidth: ".45",
                          }),
                          React.createElement("path", {
                            d: `M ${cx - 3} ${cy} H ${cx + 3} M ${cx} ${cy - 3} V ${cy + 3}`,
                            stroke: "#f3dfb2",
                            strokeWidth: ".7",
                            strokeLinecap: "round",
                          }),
                        ),
  );
}
