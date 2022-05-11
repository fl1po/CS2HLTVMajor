javascript: (() => {
    picks = {
        challengers: {
            advance: ['ENCE', 'G2', 'Astralis', 'Vitality', 'forZe', 'Outsiders', 'Liquid'],
            threeZero: 'MIBR',
            zeroThree: 'IHC',
            wonPicks: ['Vitality', 'G2', 'Outsiders'],
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

    function setColors(teams, color, isOverview) {
        teams.forEach(team => {
            team.style.color = color;
        });
    }

    function getTeams(teams, isOverview) {
        if (isOverview) {
            return teams.map(team => 
            Array.from(team.childNodes)
                .filter(node => node.className === 'text-ellipsis'))
                .map(team => team[0].firstElementChild);
        } else {
            return teams;
        }
    }

    function excludeLostPicks(teams, isOverview) {
        teams.forEach(team => {
            team.style.textDecoration = 'line-through';
        });
    }

    function includeWonPicks(teams, isOverview) {
        teams.forEach(team => {
            team.style.fontWeight = '1000';
            team.style.fontSize = '17px';
        });
    }

    function getActiveTab() {
        return document.getElementsByClassName('event-hub-link active')[0].innerText;
    }

    (function () {
        const { threeZero, zeroThree, wonPicks, lostPicks, advance } = picks.challengers;
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
        const isOverview = activeTab === 'Overview';
        const greens = getTeams(allTeams.filter((team) => advance.includes(team.innerText)), isOverview);
        const oranges = getTeams(allTeams.filter(team => team.innerText === threeZero), isOverview);
        const reds = getTeams(allTeams.filter(team => team.innerText === zeroThree), isOverview);
        const excludedTeams = getTeams(allTeams.filter(team => lostPicks.includes(team.innerText)), isOverview);
        const includedTeams = getTeams(allTeams.filter(team => wonPicks.includes(team.innerText)), isOverview);
        setColors(greens, 'green', isOverview);
        setColors(oranges, 'orange', isOverview);
        setColors(reds, 'red', isOverview);
        excludeLostPicks(excludedTeams, isOverview);
        includeWonPicks(includedTeams, isOverview);
    })()
})()