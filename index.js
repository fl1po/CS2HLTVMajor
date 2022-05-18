function setStyle(teams, styles) {
    teams.forEach(team => {
        Object.entries(styles).forEach(([style, value]) => {
            team.style[style] = value;
        })
    });
}

function getTeamNodes(teams) {
    const activeTab = getActiveTab();
    const isOverview = activeTab === 'Overview';
    if (isOverview) {
        return teams.map(team => 
            Array.from(team.childNodes)
                .filter(node => node.className === 'text-ellipsis'))
    } else {
        return teams;
    }
}

function getActiveTab() {
    const tabNode = document.getElementsByClassName('event-hub-link active');
    return tabNode?.[0]?.innerText;
    
}

function getGroupStage() {
    const title = document.getElementsByClassName('event-hub-title')[0]?.innerText;
    const playoffNode = document.getElementsByClassName('slotted-bracket-placeholder')?.[0];
    const playoffData = JSON.parse(localStorage.getItem(title))?.[title].champions;
    const hasPlayoffData = Boolean(playoffData && !!Object.values(playoffData).length || playoffNode);
    if (hasPlayoffData) return {
        playoffStage: 'champions',
        groupStage: 'legends',
        playoffNode,
        title,
    }
    if (title.includes('Challengers')) return {
        groupStage: 'challengers',
        title,
    }
    if (title.includes('Major')) return {
        groupStage: 'legends',
        title,
    }
    throw `The event is not for Pick'ems`;
}

function setData() {
    const activeTab = getActiveTab();
    const isOverview = activeTab === 'Overview';
    const { groupStage, playoffStage, playoffNode, title } = getGroupStage();
    const isPlayoff = !!playoffStage;
    const majorData = JSON.parse(localStorage.getItem(title)) || {};
    const groupData = majorData?.[title]?.[groupStage] || {};
    if (isPlayoff) var playoffData = majorData?.[title]?.[playoffStage] || {};
    switch (activeTab) {
        case 'Overview':
            var allTeams = [...document.getElementsByClassName('team text-ellipsis')];
            break;
        case 'Matches':
            var allTeams = [...document.getElementsByClassName('matchTeam')];
            break;
        default:
            var allTeams = [];
            break;
    }

    function setGroupData() {
        const teams = getTeamNodes(allTeams).map(team => team[0]);
        const results = [...teams.map(team => team.parentElement.parentElement.parentElement.children)].map(nodes => [...nodes].find((node) => node.className === 'points cell-width-record').innerText);
        teams.forEach((team, index) => {
            const teamNodes = Array.from(team.childNodes);
            const teamName = teamNodes[0].firstChild.data;
            const className = 'pick ' + teamName;
            const updatedData = {
                ...majorData,
                [title]: {
                    ...majorData?.[title],
                    [groupStage]: {
                        ...majorData?.[title]?.[groupStage],
                        [teamName]: {
                            ...(majorData?.[title]?.[groupStage] || {})[teamName],
                            state: results[index],
                        },
                    }
                }
            };
            localStorage.setItem(title, JSON.stringify(updatedData));
            const advanceLimit = Object.values(groupData).filter(({ value }) => value === 'advance').length === 7;
            const hasZeroThree = !!Object.values(groupData).find(({ value }) => value === '0-3');
            const hasThreeZero = !!Object.values(groupData).find(({ value }) => value === '3-0');
            const options = ['', 'advance', '3-0', '0-3'].filter((option) => {
                if (hasZeroThree && option === '0-3' && groupData[teamName]?.value !== '0-3') return false;
                if (hasThreeZero && option === '3-0' && groupData[teamName]?.value !== '3-0') return false;
                if (advanceLimit && option === 'advance' && groupData[teamName]?.value !== 'advance') return false;
                return true;
            });
            let selectNode = teamNodes.find(node => node.className === className);
            if (!selectNode) {
                selectNode = document.createElement('select');
                selectNode.id = team.innerText;
                selectNode.className = className;
                selectNode.style.margin = '0 20px';
                team.append(selectNode);
            } else {
                while (selectNode.firstChild) {
                    selectNode.removeChild(selectNode.firstChild);
                }
            }
            if (options.length === 1 && options[0] === '') {
                selectNode.style.display = 'none';
            } else {
                selectNode.style.display = 'inline';
            }
            selectNode.onchange = (e) => {
                const updatedData = {
                    ...majorData,
                    [title]: {
                        ...majorData?.[title],
                        [groupStage]: {
                            ...majorData?.[title]?.[groupStage],
                            [teamName]: {
                                ...(majorData?.[title]?.[groupStage] || {})[teamName],
                                value: e.target.value,
                                state: results[index],
                            },
                        }
                    }
                };
                localStorage.setItem(title, JSON.stringify(updatedData));
                setData();
            };
            options.forEach(option => {
                const optionNode = document.createElement('option');
                optionNode.className = className + 'option';
                optionNode.value = option;
                optionNode.text = option;
                optionNode.selected = option === groupData?.[teamName]?.value;
                selectNode.appendChild(optionNode);
            })
        });
    }

    if (isOverview) {
        setGroupData();
    }

    function setPlayoffData() {
        const rounds = [...playoffNode.getElementsByClassName('round')];
        if (!playoffData) {
            localStorage.setItem(title, JSON.stringify({ 
                ...majorData,
                [title]: {
                    ...majorData?.[title],
                    [playoffStage]: {}
                }
            }));
        }
        rounds.forEach((round, roundId) => {
            const slot = [...round.getElementsByClassName('slots')][0];
            const roundMatches = [...slot.getElementsByClassName('slot-wrapper')].map((node) => node.getElementsByClassName('match')[0]);
            const roundName = round.getElementsByClassName('round-header')[0].innerText;
            roundMatches.forEach((match, matchIndex) => {
                const teamNodes = [...match.children];
                const matchId = teamNodes.map(() => roundId + matchIndex).join(' vs ');
                const teamNames = teamNodes.map((node) => node.innerText);
                teamNodes.forEach((teamNode, teamId) => {
                    const teamName = teamNode.innerText;
                    const teamKey = roundId + matchId + teamId;
                    const className = `${teamName} ${roundName}`;
                    const updatedData = {
                        ...majorData,
                        [title]: {
                            ...majorData?.[title],
                            [playoffStage]: {
                                ...majorData?.[title]?.[playoffStage],
                                [roundName]: {
                                    ...majorData?.[title]?.[playoffStage]?.[roundName],
                                    [matchId]: {
                                        ...majorData?.[title]?.[playoffStage]?.[roundName]?.[matchId],
                                        [teamKey]: {
                                            ...majorData?.[title]?.[playoffStage]?.[roundName]?.[matchId]?.[teamKey],
                                            teamNames,
                                            selectedTeam: teamName,
                                        },
                                    },
                                }
                            }
                        }
                    };
                    localStorage.setItem(title, JSON.stringify(updatedData));
                    let checkNode = teamNode.getElementsByClassName(className)[0];
                    if (!checkNode) {
                        checkNode = document.createElement('input');
                        checkNode.type = 'checkbox';
                        checkNode.className = className;
                        teamNode.append(checkNode);
                    }
                    checkNode.onchange = (e) => {
                        const updatedData = {
                            ...majorData,
                            [title]: {
                                ...majorData?.[title],
                                [playoffStage]: {
                                    ...majorData?.[title]?.[playoffStage],
                                    [roundName]: {
                                        ...majorData?.[title]?.[playoffStage]?.[roundName],
                                        [matchId]: {
                                            [teamKey]: {
                                                value: e.currentTarget.checked,
                                                teamNames,
                                                selectedTeam: teamName,
                                            },
                                        },
                                    }
                                }
                            }
                        };
                        localStorage.setItem(title, JSON.stringify(updatedData));
                        setData();
                    }
                    checkNode.checked = playoffData?.[roundName]?.[matchId]?.[teamKey]?.value;
                })
            })
        })
    }

    if (isOverview && isPlayoff) {
        setPlayoffData();
    }
    const advance = Object.entries(groupData)?.filter(([_, { value }]) => value === 'advance').map(([team]) => team) || [];
    const threeZero = (Object.entries(groupData)?.find(([_, { value }]) => value === '3-0') || [])[0];
    const zeroThree = (Object.entries(groupData)?.find(([_, { value }]) => value === '0-3') || [])[0];
    const wonPicks = Object.entries(groupData)?.filter(([_, { value, state }]) => {
        return (
            value === 'advance' && state.startsWith('3')
        ) || (
            value === '3-0' && state.startsWith('3') && state.endsWith('0')
        ) || (
            value === '0-3' && state.startsWith('0') && state.endsWith('3')
        )
    }).map(([team]) => team);
    const lostPicks = Object.entries(groupData).filter(([_, { value, state }]) => {
        return (
            value === 'advance' && state.endsWith('3')
        ) || (
            value === '3-0' && !state.endsWith('0')
        ) || (
            value === '0-3' && !state.startsWith('0')
        );
    }).map(([team]) => team);
    const wonPlayoffPicks = [];
    if (isPlayoff) {
        const matchesNodes = [...document.getElementsByClassName('upcomingMatch')];
        matchesNodes.forEach((matchNode) => {
            const teamNodes = [...matchNode.getElementsByClassName('matchTeamName')];
            const teamNames = teamNodes.map(node => node.innerText);
            const matchValues = Object.values(playoffData).reduce((obj, round) => {
                Object.values(round).forEach(match => Object.values(match).forEach(pick => {
                    if (teamNames[0] === pick.teamNames[0] && teamNames[1] == pick.teamNames[1]) obj[pick.teamNames] = pick
                }));
                return obj;
            }, {});
            const activeMatch = matchValues[teamNames];
            if (activeMatch) {
                const selectedNode = teamNodes.find(teamNode => teamNode.innerText === activeMatch.selectedTeam);
                wonPlayoffPicks.push(selectedNode);
            }
        })
    }

    const defaultStyles = {
        textDecoration: 'none',
        fontWeight: '400',
        fontSize: '12px',
    };
    const teamSets = [
        {
            teamsCond: (team) => ![...advance, threeZero, zeroThree].includes(team.innerText),
            style: {
                color: '#87a3bf',
                ...defaultStyles,
            },
            isGroupStage: true,
        },
        {
            teamsCond: (team) => advance.includes(team.innerText),
            style: {
                color: 'green',
                ...defaultStyles,
            },
            isGroupStage: true,
        },
        {
            teamsCond: (team) => team.innerText === threeZero,
            style: {
                color: 'orange',
                ...defaultStyles,
            },
            isGroupStage: true,
        },
        {
            teamsCond: (team) => team.innerText === zeroThree,
            style: {
                color: 'red',
                ...defaultStyles,
            },
            isGroupStage: true,
        },
        {
            teamsCond: (team) => lostPicks.includes(team.innerText),
            style: {
                textDecoration: 'line-through',
                fontWeight: '400',
                fontSize: '12px',
            },
            isGroupStage: true,
        },
        {
            teamsCond: (team) => wonPicks.includes(team.innerText),
            style: {
                fontWeight: '1000',
                fontSize: '16px',
            },
            isGroupStage: true,
        },
        {
            style: {
                color: 'green',
            },
            isPlayoffStage: true,
        }
    ];
    if (isPlayoff && !isOverview) {
        return teamSets.filter(set => set.isPlayoffStage).forEach(({ style }) => {
            setStyle(wonPlayoffPicks, style);
        });
    }
    teamSets.filter(set => set.isGroupStage).forEach(({ teamsCond, style }) => {
        const allTabsTeams = getTeamNodes(allTeams).map(team => isOverview ? team[0].firstChild : team.children[1]).filter(teamsCond);
        setStyle(allTabsTeams, style)
    });
    
}

setData();