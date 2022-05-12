javascript: (() => {
    picks = {
        challengers: {
            advance: ['ENCE', 'G2', 'Astralis', 'Vitality', 'forZe', 'Outsiders', 'Liquid'],
            threeZero: 'MIBR',
            zeroThree: 'IHC',
            wonPicks: ['Vitality', 'G2', 'Outsiders', 'ENCE', 'Liquid'],
        },
        legends: {
            advance: [],
            threeZero: '',
            zeroThree: '',
            wonPicks: [],
            lostPicks: [],
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
                .map(team => team[0].firstElementChild);
        } else {
            return teams;
        }
    }

    function getActiveTab() {
        return document.getElementsByClassName('event-hub-link active')[0].innerText;
    }

    (function () {
        const activeTab = getActiveTab();
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
            allTeams.forEach(team => {
                check = document.createElement('input');
                check.type = 'checkbox';
                team.append(check);
            });
        }
        const { threeZero, zeroThree, wonPicks, lostPicks, advance } = picks.challengers;
        const teamSets = [
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
            const allTabsTeams = getTeams(allTeams.filter(set.teamsCond));
            setStyle(allTabsTeams, set.style)
        });
    })()
})()