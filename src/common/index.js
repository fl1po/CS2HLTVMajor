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

  function hasBracket() {
    return Boolean(byClass("slotted-bracket-placeholder")?.[0]);
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
    if (!hasBracket()) return [];
    const root = byClass("slotted-bracket-placeholder")[0];
    const rounds = [...byClass("round", root)];
    return rounds.map((round, roundId) => {
      const roundName = byClass("round-header", round)[0]?.innerText;
      const slot = [...byClass("slots", round)][0];
      if (!slot) return { roundName, matches: [] };
      const matchNodes = [...byClass("slot-wrapper", slot)].map(
        (node) => byClass("match", node)[0],
      );
      const matches = matchNodes.map((match, matchIndex) => {
        const teamNodes = [...match.children];
        const matchId = teamNodes.map(() => roundId + matchIndex).join(" vs ");
        const teamNames = teamNodes.map((node) => node.innerText);
        const teams = teamNodes.map((node, teamId) => {
          const teamKey = roundId + matchId + teamId;
          node.id = teamKey;
          return { name: node.innerText, teamKey, node };
        });
        return { matchId, teamNames, teams };
      });
      return { roundName, matches };
    });
  }

  function matchesTabRows() {
    const matchNodes = [
      ...byClass("liveMatch"),
      ...byClass("upcomingMatch"),
    ];
    return matchNodes.map((matchNode) => {
      const teamNodes = [...byClass("matchTeamName", matchNode)];
      const teamNames = teamNodes.map((node) => node.innerText);
      return { teamNodes, teamNames };
    });
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
          const selectedKey = playoffData?.[roundName]?.[matchId]?.[teamKey];
          checkNode.checked = selectedKey?.value;
          if (
            teamNode.innerText.includes(selectedKey?.selectedTeam) &&
            selectedKey.value
          ) {
            const oppositeTeam =
              teams.find((other) => other.node.id !== teamNode.id)?.node || {};
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
    HltvPage.matchesTabRows().forEach(({ teamNodes, teamNames }) => {
      const matchValues = Object.values(playoffData).reduce((obj, round) => {
        Object.values(round).forEach((match) =>
          Object.values(match).forEach((pick) => {
            if (
              teamNames[0] === pick.teamNames[0] &&
              teamNames[1] == pick.teamNames[1]
            )
              obj[pick.teamNames] = pick;
          }),
        );
        return obj;
      }, {});
      const activeMatch = matchValues[teamNames];
      if (activeMatch) {
        const selectedNode = teamNodes.find(
          (teamNode) => teamNode.innerText === activeMatch.selectedTeam,
        );
        selectedPlayoffPicks.push(selectedNode);
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
