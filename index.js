javascript: (() => {
    picks = {
        challengers: {
            wonPicks: ['Vitality', 'G2', 'Outsiders', 'ENCE', 'Liquid'],
        },
        legends: {
            wonPicks: [],
        },
    };

    picks.challengers.lostPicks = [picks.challengers.threeZero, picks.challengers.zeroThree];
    picks.legends.lostPicks = [];

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
                .map(team => team[0]);
        } else {
            return teams;
        }
    }

    function getActiveTab() {
        return document.getElementsByClassName('event-hub-link active')[0].innerText;
    }

    function getCurrentStage() {
        const title = document.getElementsByClassName('event-hub-title')[0].innerText;
        if (title.includes('Legends')) return 'legends';
        if (title.includes('Challengers')) return 'challengers';
        throw `The event is not for Pick'ems`;
    }

    (function () {
        const activeTab = getActiveTab();
        const currentStage = getCurrentStage();
        const currentStageData = JSON.parse(localStorage.getItem(currentStage));
        switch (activeTab) {
            case 'Overview':
                var allTeams = [...document.getElementsByClassName('team text-ellipsis')];
                break;
            case 'Matches':
                var allTeams = [...document.getElementsByClassName('matchTeamName text-ellipsis')];
                break;
            default:
                var allTeams = [];
                break;
        }
        if (activeTab === 'Overview') {
            const teams = getTeams(allTeams);
            teams.forEach(team => {
                const teamNodes = Array.from(team.childNodes);
                const teamName = teamNodes[0].firstChild.data;
                const className = 'pick ' + teamName;
                const selectNode = teamNodes.find(node => node.className === className);
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
                            [teamName]: e.target.value,
                        };
                        localStorage.setItem(currentStage, JSON.stringify(newData));
                    };
                    const options = ['', 'advance', '3-0', '0-3'];
                    options.forEach(option => {
                        const optionNode = document.createElement('option');
                        optionNode.value = option;
                        optionNode.text = option;
                        optionNode.selected = currentStageData && option === currentStageData[teamName];
                        select.appendChild(optionNode);
                    })
                }
                
            });
        }
        const advance = Object.entries(currentStageData).filter(([team, value]) => value === 'advance').map(([team]) => team);
        const threeZero = Object.entries(currentStageData).find(([team, value]) => value === '3-0')[0];
        const zeroThree = Object.entries(currentStageData).find(([team, value]) => value === '0-3')[0];
        const { wonPicks, lostPicks } = picks.challengers;
        const teamSets = [
            {
                teamsCond: (team) => ![...advance, threeZero, zeroThree].includes(team.innerText),
                style: {
                    color: '#87a3bf',
                },
            },
            {
                teamsCond: (team) => advance.includes(team.innerText),
                style: {
                    color: 'green',
                },
            },
            {
                teamsCond: (team) => team.innerText === threeZero,
                style: {
                    color: 'orange',
                },
            },
            {
                teamsCond: (team) => team.innerText === zeroThree,
                style: {
                    color: 'red',
                },
            },
            {
                teamsCond: (team) => lostPicks.includes(team.innerText),
                style: {
                    textDecoration: 'line-through',
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
            const allTabsTeams = getTeams(allTeams).map(team => team.firstChild).filter(set.teamsCond);
            setStyle(allTabsTeams, set.style)
        });
    })()
})()