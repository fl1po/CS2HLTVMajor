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

function getgroupStage() {
    const title = document.getElementsByClassName('event-hub-title')[0]?.innerText;
    const playoffNode = document.getElementsByClassName('slotted-bracket-placeholder')?.[0] || {};
    if (playoffNode) return {
        playoffStage: 'champions',
        groupStage: 'challengers',
        playoffNode,
    }
    if (title.includes('Challengers')) return {
        groupStage: 'challengers',
    }
    if (title.includes('Major')) return {
        groupStage: 'legends',
    }
    throw `The event is not for Pick'ems`;
}

function setData() {
    const activeTab = getActiveTab();
    const isOverview = activeTab === 'Overview';
    const { groupStage, playoffStage, playoffNode } = getgroupStage();
    const isPlayoff = !!playoffStage;
    const groupData = JSON.parse(localStorage.getItem(groupStage)) || {};
    if (isPlayoff) var playoffData = JSON.parse(localStorage.getItem(playoffStage));
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
            const data = JSON.parse(localStorage.getItem(groupStage));
            const updatedData = {
                ...data,
                [teamName]: {
                    ...(data || {})[teamName],
                    state: results[index],
                },
            };
            localStorage.setItem(groupStage, JSON.stringify(updatedData));
            const advanceLimit = Object.values(data).filter(({ value }) => value === 'advance').length === 7;
            const hasZeroThree = !!Object.values(data).find(({ value }) => value === '0-3');
            const hasThreeZero = !!Object.values(data).find(({ value }) => value === '3-0');
            const options = ['', 'advance', '3-0', '0-3'].filter((option) => {
                if (hasZeroThree && option === '0-3' && data[teamName]?.value !== '0-3') return false;
                if (hasThreeZero && option === '3-0' && data[teamName]?.value !== '3-0') return false;
                if (advanceLimit && option === 'advance' && data[teamName]?.value !== 'advance') return false;
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
                const newData = {
                    ...data,
                    [teamName]: {
                        value: e.target.value,
                        state: results[index],
                    },
                };
                localStorage.setItem(groupStage, JSON.stringify(newData));
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
        const data = JSON.parse(localStorage.getItem(playoffStage));
        rounds.forEach((round, roundId) => {
            const slot = [...round.getElementsByClassName('slots')][0];
            const roundMatches = [...slot.getElementsByClassName('slot-wrapper')].map((node) => node.getElementsByClassName('match')[0]);
            const roundName = round.getElementsByClassName('round-header')[0].innerText;
            roundMatches.forEach((match, matchIndex) => {
                const teamNodes = [...match.children];
                const matchId = teamNodes.map((node) => roundId + matchIndex).join(' vs ');
                teamNodes.forEach((teamNode, teamId) => {
                    const teamName = teamNode.innerText;
                    const teamKey = roundId + matchId + teamId;
                    const className = `${teamName} ${roundName}`;
                    let checkNode = teamNode.getElementsByClassName(className)[0];
                    if (!checkNode) {
                        checkNode = document.createElement('input');
                        checkNode.type = 'checkbox';
                        checkNode.className = className;
                        teamNode.append(checkNode);
                    }
                    checkNode.onchange = (e) => {
                        const newData = {
                            ...data,
                            [roundName]: {
                                ...data?.[roundName] || {},
                                [matchId]: {
                                    [teamKey]: {
                                        value: e.currentTarget.checked,
                                        teamName,
                                    },
                                },
                                
                            }
                        };
                        localStorage.setItem(playoffStage, JSON.stringify(newData));
                        setPlayoffData();
                    }
                    checkNode.checked = data?.[roundName]?.[matchId]?.[teamKey]?.value;
                })
            })
        })
    }

    if (isPlayoff) {
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
        },
        {
            teamsCond: (team) => advance.includes(team.innerText),
            style: {
                color: 'green',
                ...defaultStyles,
            },
        },
        {
            teamsCond: (team) => team.innerText === threeZero,
            style: {
                color: 'orange',
                ...defaultStyles,
            },
        },
        {
            teamsCond: (team) => team.innerText === zeroThree,
            style: {
                color: 'red',
                ...defaultStyles,
            },
        },
        {
            teamsCond: (team) => lostPicks.includes(team.innerText),
            style: {
                textDecoration: 'line-through',
                fontWeight: '400',
                fontSize: '12px',
            },
        },
        {
            teamsCond: (team) => wonPicks.includes(team.innerText),
            style: {
                fontWeight: '1000',
                fontSize: '16px',
            },
        }
    ];
    teamSets.forEach(({ teamsCond, style }) => {
        const allTabsTeams = getTeamNodes(allTeams).map(team => isOverview ? team[0].firstChild : team.children[1]).filter(teamsCond);
        setStyle(allTabsTeams, style)
    });
}

setData();