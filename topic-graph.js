const initTopicGraph = (selectorPrefix, graphSettings, graphTopics) => {
    const settings = {
        ...graphSettings,
        topics: graphTopics,
    };

    let chart = null;
    let initialNodeData = null;
    let editMode = !!settings.editMode;
    const articleCache = {};

    const init = () => {
        initialNodeData = extractNodesAndLinks(settings.topics);

        const allNodesHasXY = initialNodeData.nodes.every(node => hasXY(node));
        
        // chart options
        const options = {
            series: [
                {
                    type: 'graph',
                    layout: allNodesHasXY && !editMode ? 'none' : 'force',
                    force: {
                        edgeLength: 200,
                        gravity: 0,
                        repulsion: 0,
                    },
                    roam: true,
                    draggable: editMode,
                    lineStyle: {
                        curveness: 0.2,
                    },
                    itemStyle: {
                        normal: {
                            borderColor: '#fff',
                            borderWidth: 1,
                            shadowBlur: 16,
                            shadowColor: 'rgba(0, 0, 0, 0.3)',
                        },
                        emphasis: {
                            borderColor: 'rgb(180,180,180)',
                            shadowBlur: 16,
                            shadowColor: 'rgba(0, 0, 0, 0.4)',
                        },
                    },
                    ...initialNodeData,
                }
            ]
        };

        // init chart
        chart = echarts.init(document.querySelector(selectorPrefix + ' .topic-graph'));
        chart.on('click', (e) => {
            if (e.componentType !== 'series' || e.dataType !== 'node') return;
            if (!e.data.topic.url) return;
            if (e.data.id === 0) openArticle();
            else openArticleWithId(e.data.topic.id);
        });
        chart.showLoading();
        chart.setOption(options);
        chart.hideLoading();

        // buttons
        document.querySelector(selectorPrefix + ' .graph-article-close').addEventListener('click', () => closeArticle());
        document.querySelector(selectorPrefix + ' .graph-article-overlay').addEventListener('click', () => closeArticle());
        if (editMode) {
            const cp = document.querySelector(selectorPrefix + ' .copy-topics');
            cp.addEventListener('click', () => copyTopics());
            cp.classList.add('show');
        }

        const createAccordionButton = (id, name) => {
            const el = document.createElement('button');
            el.classList.add('tg-accordion');
            el.classList.add(`tg-accordion-${id}`);
            el.innerHTML = name;
            el.addEventListener('click', () => openAccordion(id));
            return el;
        };

        const createTabButton = (id, name) => {
            const el = document.createElement('button');
            el.classList.add('tg-tablinks');
            el.classList.add(`tg-tab-button-${id}`);
            el.innerHTML = name;
            el.addEventListener('click', () => openTab(id));
            return el;
        };

        // load article menu
        const menu = document.querySelector(selectorPrefix + ' .graph-article-menu');
        for (const [idA, topic] of settings.topics[0].subtopics.entries()) {
            menu.appendChild(createAccordionButton(idA, topic.name));
            menu.insertAdjacentHTML('beforeend', 
                `<div class="tg-panel tg-panel-${idA}">
                    <div class="tg-tab"></div>
                </div>`
            );
            const tabMenus = menu.querySelectorAll('.tg-tab');
            const tabMenu = tabMenus[tabMenus.length - 1];
            const tabs = tabMenu.parentElement;
            for (const [idB, tab] of topic.subtopics.entries()) {
                tab.id = `${idA}-${idB}`;
                tabMenu.appendChild(createTabButton(tab.id, tab.name));
                tabs.insertAdjacentHTML('beforeend', 
                    `<div class="tg-tabcontent tg-tab-${tab.id}">
                        <h3>Tab ${tab.id}</h3>
                        <p>London is the capital city of England.</p>
                    </div>`
                );
            }
        }

        // preload articles
        initialNodeData.nodes.filter(node => node.topic.id).forEach((node) => preloadArticle(node.topic.id));
    };

    const toggleEitMode = () => {
        if (!editMode) {
            chart.setOption({
                series: [
                    {
                        layout: 'force',
                        draggable: true,
                    },
                ],
            });
            editMode = true;
        } else {
            chart.setOption({
                series: [
                    {
                        layout: 'none',
                        draggable: false,
                        data: getNodesWithXY(),
                    },
                ],
            });
            editMode = false;
        }
    };

    const openArticleWithId = async (id) => {
        const ids = id.split('-');
        openAccordion(id[0], id[1]);
        openArticle();
    };
    const preloadArticle = async (id, name) => {
        const data = await getArticle(name);
        document.querySelector(selectorPrefix + ` .tg-tab-${id}`).innerHTML = data;
    };
    const getArticle = async (name) => {
        let url = settings.articleRoot + name;
        if (settings.useProxy) url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const res = await fetch(url);
        let data = await res.text();
        if (settings.articleSource === 'telegraph') {
            data = cutFrom(data, '<article id="_tl_editor" class="tl_article_content">');
            data = cutTo(data, '</article>');
            data = data.replaceAll('<img src="', '<img src="https://telegra.ph');
            data = data.replaceAll('<video src="', '<video src="https://telegra.ph');
        } else if (settings.articleSource === 'tilda') {
            data = cutFrom(data, '<!--allrecords-->');
            data = cutTo(data, '<!--/allrecords-->');
        }
        return data;
    };

    const toggleArticle = () => {
        if (document.querySelector(selectorPrefix + ' .graph-article').classList.contains('open')) closeArticle();
        else openArticle();
    };

    const openArticle = () => {
        document.querySelector(selectorPrefix + ' .graph-article').classList.add('open');
        document.querySelector(selectorPrefix + ' .graph-article-overlay').classList.add('open');
    };

    const closeArticle = () => {
        document.querySelector(selectorPrefix + ' .graph-article').classList.remove('open');
        document.querySelector(selectorPrefix + ' .graph-article-overlay').classList.remove('open');
    };

    const openAccordion = (id, tabId = 0) => {
        // close all accordions
        const accordions = document.querySelectorAll(selectorPrefix + ' .tg-accordion');
        for (const acc2 of accordions) {
            if (!acc2.classList.contains('tg-active')) continue;
            acc2.classList.remove('tg-active');
            acc2.nextElementSibling.style.maxHeight = null;
        }

        openTab(`${id}-${tabId}`);
        const el = document.querySelector(selectorPrefix + ` .tg-accordion-${id}`)
        el.classList.toggle('tg-active');
        const panel = el.nextElementSibling;
        if (panel.style.maxHeight) panel.style.maxHeight = null;
        else panel.style.maxHeight = panel.scrollHeight + 'px';
    };
    const openTab = (id) => {
        const tabcontents = document.getElementsByClassName('tg-tabcontent');
        for (const el of tabcontents) {
            el.style.display = 'none';
        }
        const tablinks = document.getElementsByClassName('tg-tablinks');
        for (const el of tablinks) {
            el.classList.remove('tg-active');
        }
        document.querySelector(selectorPrefix + ` .tg-tab-${id}`).style.display = 'block';
        document.querySelector(selectorPrefix + ` .tg-tab-button-${id}`).classList.add('tg-active');
    }

    // helpers
    const extractNodesAndLinks = (topics, parent = null, nodes = [], links = [], level = 0) => {
        for (const t of topics) {
            const node = topicToNode(t, parent, level);
            node.id = nodes.push(node) - 1;
            if (parent !== null) links.push({source: parent.id, target: node.id});
            if (t.subtopics) extractNodesAndLinks(t.subtopics, node, nodes, links, level + 1);
        }
        return {nodes, links};
    };

    const topicToNode = (topic, parent, level) => ({
        name: topic.name,
        itemStyle: {
            color: topic.color || parent?.itemStyle?.color || null,
        },
        symbolSize: 100 / (2 ** level),
        label: {
            show: level <= 1,
            position: level > 0 ? 'right' : 'inside',
            fontSize: level > 1 ? 12 : level > 0 ? 14 : 18,
        },
        topic,
        ...(hasXY(topic) ? {x: topic.x, y: topic.y} : {}),
    });

    const getNodeXY = (chart, id) => ({
        x: chart._model._componentsMap.data.series[0].preservedPoints[id][0],
        y: chart._model._componentsMap.data.series[0].preservedPoints[id][1],
    });
    const getNodesWithXY = () => initialNodeData.nodes.map(node => ({...node, ...getNodeXY(chart, node.id)}));
    const getTopicsWithXY = () => {
        for (const node of initialNodeData.nodes) {
            const pos = getNodeXY(chart, node.id);
            node.topic.x = pos.x;
            node.topic.y = pos.y;
            delete node.topic.id;
        }
        return settings.topics;
    };
    const copyTopics = () => copyToClipboard(JSON.stringify(getTopicsWithXY(), null, 4));
    const hasXY = (obj) => Object.prototype.hasOwnProperty.call(obj, 'x') && Object.prototype.hasOwnProperty.call(obj, 'y');
    const cutFrom = (data, token) => {
        const idx = data.indexOf(token);
        if (idx < 0) return data;
        return data.substring(idx + token.length);
    };
    const cutTo = (data, token) => {
        const idx = data.indexOf(token);
        if (idx < 0) return data;
        return data.substring(0, idx);
    };

    const copyToClipboard = (text) => {
        var dummy = document.createElement('textarea');
        document.body.appendChild(dummy);
        dummy.value = text;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
    }

    init();
    return {chart, toggleEitMode, getTopicsWithXY, copyTopics};
}