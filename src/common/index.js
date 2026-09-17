function setStyle(teams, styles) {
  teams.forEach((team) => {
    Object.entries(styles).forEach(([style, value]) => {
      team.style[style] = value;
    });
  });
}

var defaultStyles = {
  textDecoration: "none",
  fontWeight: "400",
  fontSize: "12px",
};


function setIn(obj, path, leaf) {
  if (path.length === 0) return { ...obj, ...leaf };
  const [key, ...rest] = path;
  return { ...obj, [key]: setIn(obj?.[key] ?? {}, rest, leaf) };
}

const PickemsStore = (() => {
  function forMajor(title) {
    const read = () => JSON.parse(localStorage.getItem(title)) || {};
    const write = (majorData) =>
      localStorage.setItem(title, JSON.stringify(majorData));

    const setters = (get, set) => ({
      setGroupPick(groupStage, teamName, pick) {
        set(setIn(get(), [title, groupStage, teamName], pick));
      },
      setPlayoffPick(playoffStage, roundName, matchId, teamKey, pick) {
        set(setIn(get(), [title, playoffStage, roundName, matchId, teamKey], pick));
      },
    });

    return {
      // The "champions" probe used by stage detection. Returns the stored
      // playoff picks object (or undefined) without defaulting, so callers can
      // distinguish "absent" from "present but empty".
      hasPlayoffPicks() {
        return read()?.[title]?.champions;
      },
      getGroupPicks(groupStage) {
        return read()?.[title]?.[groupStage] || {};
      },
      getPlayoffPicks(playoffStage) {
        return read()?.[title]?.[playoffStage] || {};
      },
      ...setters(read, write),
      batch(apply) {
        let draft = read();
        apply(setters(() => draft, (next) => (draft = next)));
        write(draft);
      },
    };
  }

  return { forMajor };
})();

const HltvPage = (() => {
  const byClass = (cls, root = document) => root.getElementsByClassName(cls);

  function activeTab() {
    return byClass("event-hub-link active")?.[0]?.innerText;
  }

  function isOverview() {
    return activeTab() === "Overview";
  }

  function eventTitle() {
    return byClass("event-hub-title")[0]?.innerText;
  }

  // An event can show more than one bracket (group playoffs are one placeholder
  // per group), so every read has to walk all of them, not just the first.
  function bracketRoots() {
    return [...byClass("slotted-bracket-placeholder")];
  }

  function hasBracket() {
    return bracketRoots().length > 0;
  }

  // HLTV hides `.team-name` while a round is collapsed and floats the score
  // beside it, so `innerText` on a bracket team is "" or "MOUZ\n1". The name
  // only ever lives in `.team-name`.
  function bracketTeamName(teamNode) {
    const nameNode = byClass("team-name", teamNode)[0];
    return (nameNode?.textContent ?? teamNode.innerText ?? "").trim();
  }

  // A round header shows the round's short name while collapsed and its full
  // name while expanded, so the visible text flips whenever the user toggles a
  // round. The bracket model carries both spellings; map every short name back
  // to the full one so a pick keeps its key across a toggle.
  function canonicalRoundNames(root) {
    const names = {};
    let model;
    try {
      model = JSON.parse(root.dataset.slottedBracketJson);
    } catch {
      return names;
    }
    (function collect(node) {
      if (!node || typeof node !== "object") return;
      if (typeof node.name === "string" && typeof node.shortName === "string") {
        names[node.shortName] = node.name;
      }
      Object.values(node).forEach(collect);
    })(model);
    return names;
  }

  const overviewNameNodes = () =>
    [...byClass("team text-ellipsis")].map(
      (team) =>
        [...team.childNodes].filter(
          (node) => node.className === "text-ellipsis",
        )[0],
    );

  function groupPickRows() {
    return overviewNameNodes().map((nameNode) => {
      const name = [...nameNode.childNodes][0].firstChild.data;
      const resultRow =
        nameNode.parentElement.parentElement.parentElement.children;
      const resultState = [...resultRow].find(
        (node) => node.className === "points cell-width-record",
      ).innerText;
      return { name, resultState, nameNode };
    });
  }

  function groupStyleNodes() {
    if (isOverview()) {
      return overviewNameNodes().map((nameNode) => nameNode.firstChild);
    }
    return [...byClass("match-teamname")];
  }

  function playoffBracket() {
    const rounds = [];
    let roundId = 0;
    bracketRoots().forEach((root) => {
      const canonical = canonicalRoundNames(root);
      [...byClass("round", root)].forEach((round) => {
        // Every `.round` consumes an id, including the empty spacer rounds HLTV
        // uses to line the upper and lower tiers up, and the counter runs across
        // brackets, so ids stay unique and stable.
        const currentRoundId = roundId++;
        const slot = byClass("slots", round)[0];
        if (!slot) return;
        const header = byClass("round-header", round)[0]?.innerText;
        const roundName =
          canonical[header] ?? header ?? `round ${currentRoundId}`;
        const matches = [...byClass("slot-wrapper", slot)]
          .map((node) => byClass("match", node)[0])
          .filter(Boolean)
          .map((match, matchIndex) => {
            const teamNodes = [...match.children];
            const matchId = teamNodes
              .map(() => currentRoundId + matchIndex)
              .join(" vs ");
            const teams = teamNodes.map((node, teamId) => ({
              name: bracketTeamName(node),
              teamKey: currentRoundId + matchId + teamId,
              node,
            }));
            return { matchId, teamNames: teams.map(({ name }) => name), teams };
          });
        rounds.push({ roundName, matches });
      });
    });
    return rounds;
  }

  function matchesTabRows() {
    return [...byClass("match-wrapper")]
      .map((matchNode) => {
        const teamNodes = [...byClass("match-teamname", matchNode)];
        const teamNames = teamNodes.map((node) => node.innerText.trim());
        return { teamNodes, teamNames };
      })
      // A row whose teams are not drawn yet carries no team names at all.
      .filter(({ teamNodes }) => teamNodes.length === 2);
  }

  return {
    activeTab,
    isOverview,
    eventTitle,
    hasBracket,
    groupPickRows,
    groupStyleNodes,
    playoffBracket,
    matchesTabRows,
  };
})();

function detectStage(store, title, bracket) {
  const championsPicks = store.hasPlayoffPicks();
  const hasChampionsData = championsPicks && Object.values(championsPicks).length;
  let hasUndecided = false;
  if (bracket.length) {
    hasUndecided = (bracket[0]?.matches || []).some((match) =>
      match.teamNames.includes("TBD"),
    );
  }
  const hasPlayoffData =
    Boolean(hasChampionsData || HltvPage.hasBracket()) && !hasUndecided;
  if (hasPlayoffData)
    return { playoffStage: "champions", groupStage: "legends" };
  if (title.includes("Challengers")) return { groupStage: "challengers" };
  if (title.includes("Major")) return { groupStage: "legends" };
  // An undecided bracket means "the group stage is still running" only on a
  // Major, which shows both on one page. Anywhere else the bracket is all there
  // is, so an unseeded one is still the thing to pick on.
  if (HltvPage.hasBracket())
    return { playoffStage: "champions", groupStage: "legends" };
  throw `The event is not for Pick'ems`;
}

function setData() {
  const title = HltvPage.eventTitle();
  if (!title) return;

  const store = PickemsStore.forMajor(title);
  const bracket = HltvPage.playoffBracket();
  const { groupStage, playoffStage } = detectStage(store, title, bracket);
  const isOverview = HltvPage.isOverview();
  const isPlayoff = !!playoffStage;
  const groupData = store.getGroupPicks(groupStage);
  const playoffData = isPlayoff ? store.getPlayoffPicks(playoffStage) : undefined;

  function setGroupData() {
    const rows = HltvPage.groupPickRows();
    store.batch((tx) =>
      rows.forEach(({ name: teamName, resultState }) =>
        tx.setGroupPick(groupStage, teamName, { state: resultState }),
      ),
    );
    rows.forEach(({ name: teamName, resultState, nameNode }) => {
      const className = "pick " + teamName;
      const advanceLimit =
        Object.values(groupData).filter(({ value }) => value === "advance")
          .length === 6;
      const hasZeroThree =
        Object.values(groupData).filter(({ value }) => value === "0-3")
          .length === 2;
      const hasThreeZero =
        Object.values(groupData).filter(({ value }) => value === "3-0")
          .length === 2;
      const options = ["", "advance", "3-0", "0-3"].filter((option) => {
        if (
          hasZeroThree &&
          option === "0-3" &&
          groupData[teamName]?.value !== "0-3"
        )
          return false;
        if (
          hasThreeZero &&
          option === "3-0" &&
          groupData[teamName]?.value !== "3-0"
        )
          return false;
        if (
          advanceLimit &&
          option === "advance" &&
          groupData[teamName]?.value !== "advance"
        )
          return false;
        return true;
      });
      let selectNode = [...nameNode.childNodes].find(
        (node) => node.className === className,
      );
      if (!selectNode) {
        selectNode = document.createElement("select");
        selectNode.id = nameNode.innerText;
        selectNode.className = className;
        selectNode.style.margin = "0 20px";
        nameNode.append(selectNode);
      } else {
        while (selectNode.firstChild) {
          selectNode.removeChild(selectNode.firstChild);
        }
      }
      if (options.length === 1 && options[0] === "") {
        selectNode.style.display = "none";
      } else {
        selectNode.style.display = "inline";
      }
      selectNode.onchange = (e) => {
        store.setGroupPick(groupStage, teamName, {
          value: e.target.value,
          state: resultState,
        });
        setData();
      };
      options.forEach((option) => {
        const optionNode = document.createElement("option");
        optionNode.className = className + "option";
        optionNode.value = option;
        optionNode.text = option;
        optionNode.selected = option === groupData?.[teamName]?.value;
        selectNode.appendChild(optionNode);
      });
    });
  }

  if (isOverview) {
    setGroupData();
  }

  function setPlayoffData() {

    store.batch((tx) =>
      bracket.forEach(({ roundName, matches }) =>
        matches.forEach(({ matchId, teamNames, teams }) =>
          teams.forEach(({ name: teamName, teamKey }) =>
            tx.setPlayoffPick(playoffStage, roundName, matchId, teamKey, {
              teamNames,
              selectedTeam: teamName,
            }),
          ),
        ),
      ),
    );
    // Re-read: the batch above refreshed every team name from the page, and the
    // snapshot taken before it still carries the previous run's names.
    const picks = store.getPlayoffPicks(playoffStage);
    bracket.forEach(({ roundName, matches }) => {
      matches.forEach(({ matchId, teamNames, teams }) => {
        teams.forEach(({ name: teamName, teamKey, node: teamNode }) => {
          const className = `${teamKey} ${roundName}`;
          let checkNode = teamNode.getElementsByClassName(className)[0];
          if (!checkNode) {
            checkNode = document.createElement("input");
            checkNode.type = "checkbox";
            checkNode.className = className;
            teamNode.append(checkNode);
          }
          const selectedKey = picks?.[roundName]?.[matchId]?.[teamKey];
          checkNode.checked = Boolean(selectedKey?.value);
          if (selectedKey?.value) {
            const oppositeTeam =
              teams.find((other) => other.node !== teamNode)?.node || {};
            const isWinner = [...teamNode.classList].includes("winner");
            const isLoser = [...teamNode.classList].includes("loser");
            if (isWinner) {
              wonPlayoffPicks.push(teamNode);
              setStyle([teamNode], { color: "green", fontWeight: 700 });
            }
            if (isLoser) {
              lostPlayoffPicks.push(teamNode);
              setStyle([teamNode], { color: "red" });
            }
            setStyle([oppositeTeam], {
              ...defaultStyles,
              color: "#929a9e",
              fontSize: "11px",
            });
          } else {
            setStyle([teamNode], {
              ...defaultStyles,
              color: "#929a9e",
              fontSize: "11px",
            });
          }
          checkNode.onchange = (e) => {
            store.setPlayoffPick(playoffStage, roundName, matchId, teamKey, {
              value: e.currentTarget.checked,
              teamNames,
              selectedTeam: teamName,
            });
            setData();
          };
        });
      });
    });
  }

  const advance =
    Object.entries(groupData)
      ?.filter(([_, { value }]) => value === "advance")
      .map(([team]) => team) || [];
  const threeZero =
    Object.entries(groupData)
      ?.filter(([_, { value }]) => value === "3-0")
      .map(([team]) => team) || [];
  const zeroThree =
    Object.entries(groupData)
      ?.filter(([_, { value }]) => value === "0-3")
      .map(([team]) => team) || [];
  const wonPicks = Object.entries(groupData)
    ?.filter(([_, { value, state }]) => {
      return (
        (value === "advance" &&
          state.startsWith("3") &&
          !state.endsWith("0")) ||
        (value === "3-0" && state.startsWith("3") && state.endsWith("0")) ||
        (value === "0-3" && state.startsWith("0") && state.endsWith("3"))
      );
    })
    .map(([team]) => team);
  const lostPicks = Object.entries(groupData)
    .filter(([_, { value, state }]) => {
      return (
        (value === "advance" &&
          (state.endsWith("3") ||
            (state.startsWith("3") && state.endsWith("0")))) ||
        (value === "3-0" && !state.endsWith("0")) ||
        (value === "0-3" && !state.startsWith("0"))
      );
    })
    .map(([team]) => team);
  const selectedPlayoffPicks = [];
  const wonPlayoffPicks = [];
  const lostPlayoffPicks = [];

  if (isOverview && isPlayoff) {
    setPlayoffData();
  }

  if (isPlayoff && !isOverview) {
    // Every team of every bracket match is stored, picked or not, so match on
    // the picked one only — otherwise the last team of the match always wins.
    const madePicks = Object.values(playoffData)
      .flatMap((round) => Object.values(round))
      .flatMap((match) => Object.values(match))
      .filter((pick) => pick.value && pick.teamNames);
    HltvPage.matchesTabRows().forEach(({ teamNodes, teamNames }) => {
      const pick = madePicks.find(
        ({ teamNames: picked }) =>
          picked[0] === teamNames[0] && picked[1] === teamNames[1],
      );
      const selectedIndex = teamNames.indexOf(pick?.selectedTeam);
      if (selectedIndex !== -1) {
        selectedPlayoffPicks.push(teamNodes[selectedIndex]);
      }
    });
  }

  const teamSets = [
    {
      teamsCond: (team) =>
        ![...advance, ...threeZero, ...zeroThree].includes(team.innerText),
      style: {
        color: "#87a3bf",
        ...defaultStyles,
      },
      isGroupStage: true,
    },
    {
      teamsCond: (team) => advance.includes(team.innerText),
      style: {
        color: "green",
        ...defaultStyles,
      },
      isGroupStage: true,
    },
    {
      teamsCond: (team) => threeZero.includes(team.innerText),
      style: {
        color: "orange",
        ...defaultStyles,
      },
      isGroupStage: true,
    },
    {
      teamsCond: (team) => zeroThree.includes(team.innerText),
      style: {
        color: "red",
        ...defaultStyles,
      },
      isGroupStage: true,
    },
    {
      teamsCond: (team) => lostPicks.includes(team.innerText),
      style: {
        textDecoration: "line-through",
        fontWeight: "400",
        fontSize: "12px",
      },
      isGroupStage: true,
    },
    {
      teamsCond: (team) => wonPicks.includes(team.innerText),
      style: {
        fontWeight: "1000",
        fontSize: "16px",
      },
      isGroupStage: true,
    },
    {
      style: {
        color: "green",
      },
      isPlayoffStage: true,
    },
  ];
  if (isPlayoff && !isOverview) {
    return teamSets
      .filter(({ isPlayoffStage }) => isPlayoffStage)
      .forEach(({ style }) => {
        setStyle(selectedPlayoffPicks, style);
      });
  }
  const styleNodes = HltvPage.groupStyleNodes();
  teamSets
    .filter((set) => set.isGroupStage)
    .forEach(({ teamsCond, style }) => {
      setStyle(styleNodes.filter(teamsCond), style);
    });
}

function initPickems() {
  if (window.__cs2Pickems) {
    window.__cs2Pickems.run();
    return;
  }

  let scheduled = false;
  const run = () => {
    observer.disconnect();
    try {
      setData();
    } catch (error) {
      console.error("CS2 HLTV Major:", error);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      run();
    }, 300);
  });

  window.__cs2Pickems = { run };
  run();
}

initPickems();
