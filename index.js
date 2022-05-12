javascript: (() => {
    function setStyle(teams, styles) {
        teams.forEach(team => {
            Object.entries(styles).forEach(([style, value]) => {
                team.style[style] = value;
            })
        });
    }

    function getTeams(teams) {
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
        return tabNode && tabNode[0] && tabNode[0].innerText;
    }

    function getCurrentStage() {
        const title = document.getElementsByClassName('event-hub-title')[0].innerText;
        if (title.includes('Challengers')) return 'challengers';
        if (title.includes('Major')) return 'legends';
        throw `The event is not for Pick'ems`;
    }

    (function () {
        const activeTab = getActiveTab();
        const isOverview = activeTab === 'Overview';
        const currentStage = getCurrentStage();
        const currentStageData = JSON.parse(localStorage.getItem(currentStage));
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
        if (isOverview) {
            const teams = getTeams(allTeams).map(team => team[0]);
            const results = [...teams.map(team => team.parentElement.parentElement.parentElement.children)].map(nodes => [...nodes].find((node) => node.className === 'points cell-width-record').innerText);
            teams.forEach((team, index) => {
                const teamNodes = Array.from(team.childNodes);
                const teamName = teamNodes[0].firstChild.data;
                const className = 'pick ' + teamName;
                const selectNode = teamNodes.find(node => node.className === className);
                const data = JSON.parse(localStorage.getItem(currentStage));
                const updatedData = {
                    ...data,
                    [teamName]: {
                        ...(data || {})[teamName],
                        state: results[index],
                    },
                };
                localStorage.setItem(currentStage, JSON.stringify(updatedData));
                if (!selectNode) {
                    const select = document.createElement('select');
                    select.id = team.innerText;
                    select.className = className;
                    select.style.margin = '0 20px';
                    team.append(select);
                    select.onchange = (e) => {
                        const data = JSON.parse(localStorage.getItem(currentStage));
                        const newData = {
                            ...data,
                            [teamName]: {
                                value: e.target.value,
                                state: results[index],
                            },
                        };
                        localStorage.setItem(currentStage, JSON.stringify(newData));
                    };
                    const options = ['', 'advance', '3-0', '0-3'];
                    options.forEach(option => {
                        const optionNode = document.createElement('option');
                        optionNode.value = option;
                        optionNode.text = option;
                        optionNode.selected = currentStageData && currentStageData[teamName] && option === currentStageData[teamName].value;
                        select.appendChild(optionNode);
                    })
                }
                
            });
        }
        const advance = currentStageData && Object.entries(currentStageData).filter(([_, { value }]) => value === 'advance').map(([team]) => team) || [];
        const threeZero = currentStageData && (Object.entries(currentStageData).find(([_, { value }]) => value === '3-0') || [])[0];
        const zeroThree = currentStageData && (Object.entries(currentStageData).find(([_, { value }]) => value === '0-3') || [])[0];
        const wonPicks = currentStageData && Object.entries(currentStageData).filter(([_, { value, state }]) => value === 'advance' && state.startsWith('3')).map(([team]) => team);
        const lostPicks = currentStageData && Object.entries(currentStageData).filter(([_, { value, state }]) => {
            return (
                value === 'advance' && state.endsWith('3')
            ) || (
                value === '3-0' && !state.endsWith('0')
            ) || (
                value === '0-3' && !state.startsWith('3') && state.endsWith('3')
            );
        }).map(([team]) => team);
        const teamSets = [
            {
                teamsCond: (team) => ![...advance, threeZero, zeroThree].includes(team.innerText),
                style: {
                    color: '#87a3bf',
                    textDecoration: 'none',
                    fontWeight: '400',
                    fontSize: '12px',
                },
            },
            {
                teamsCond: (team) => advance.includes(team.innerText),
                style: {
                    color: 'green',
                    textDecoration: 'none',
                    fontWeight: '400',
                    fontSize: '12px',
                },
            },
            {
                teamsCond: (team) => team.innerText === threeZero,
                style: {
                    color: 'orange',
                    textDecoration: 'none',
                    fontWeight: '400',
                    fontSize: '12px',
                },
            },
            {
                teamsCond: (team) => team.innerText === zeroThree,
                style: {
                    color: 'red',
                    textDecoration: 'none',
                    fontWeight: '400',
                    fontSize: '12px',
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
        teamSets.forEach((set) => {
            const allTabsTeams = getTeams(allTeams).map(team => isOverview ? team[0].firstChild : team.children[1]).filter(set.teamsCond);
            setStyle(allTabsTeams, set.style)
        });
    })()
})()