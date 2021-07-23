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

        chart = echarts.init(document.querySelector(selectorPrefix + ' .topic-graph'));
        chart.on('click', (e) => {
            if (e.componentType !== 'series' || e.dataType !== 'node') return;
            if (!e.data.topic.url) return;
            loadArticle(e.data.topic.url);
        });
        chart.showLoading();
        chart.setOption(options);
        chart.hideLoading();

        document.querySelector(selectorPrefix + ' .graph-article-close').addEventListener('click', () => closeArticle());
        document.querySelector(selectorPrefix + ' .graph-article-overlay').addEventListener('click', () => closeArticle());
        if (editMode) {
            const cp = document.querySelector(selectorPrefix + ' .copy-topics');
            cp.addEventListener('click', () => copyTopics());
            cp.classList.add('show');
        }
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

    const loadArticle = async (name) => {
        if (!Object.prototype.hasOwnProperty.call(articleCache, name)) await loadArticleToCache(name);
        document.querySelector(selectorPrefix + ' .graph-article-content').innerHTML = articleCache[name];
        document.querySelector(selectorPrefix + ' .graph-article').classList.add('open');
        document.querySelector(selectorPrefix + ' .graph-article-overlay').classList.add('open');
    };
    const loadArticleToCache = async (name) => {
        const res = await fetch(settings.articleRoot + name);
        let data = await res.text();
        data = cutFrom(data, '<!--allrecords-->');
        data = cutTo(data, '<!--/allrecords-->');
        articleCache[name] = data;
        //articleCache[name] = name;
    };

    const closeArticle = () => {
        document.querySelector(selectorPrefix + ' .graph-article').classList.remove('open');
        document.querySelector(selectorPrefix + ' .graph-article-overlay').classList.remove('open');
    };

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
        }
        return settings.topics;
    };
    const copyTopics = () => {
        prompt("Copy this:", JSON.stringify(getTopicsWithXY(), null, 4));
    };
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

    init();
    return {chart, toggleEitMode, getTopicsWithXY, copyTopics};
}