(function () {
    'use strict';

    // Cache DOM nodes for speed
    var d = document;
    var v_login = d.getElementById('login-view');
    var v_feed = d.getElementById('feed-view');
    var v_create = d.getElementById('create-view');
    var nav = d.getElementById('n');
    var posts_cont = d.getElementById('posts-container');
    var nav_walk = d.getElementById('nav-walk');
    var nav_home = d.getElementById('nav-home');

    var btn_login = d.getElementById('btn-login');
    var btn_create = d.getElementById('btn-create');
    var btn_cancel = d.getElementById('btn-cancel');
    var btn_post = d.getElementById('btn-post');
    var post_text = d.getElementById('post-text');
    var create_title = d.getElementById('create-title');
    var walk_fields = d.getElementById('walk-fields');
    var privacy_section = d.getElementById('privacy-section');
    var privacy_select = d.getElementById('privacy-select');
    var walk_from = d.getElementById('walk-from');
    var walk_to = d.getElementById('walk-to');

    // Data - using simple arrays for memory efficiency
    var posts = [
        { id: 1, user: "Erik S.", text: "Behöver hjälp med att bära en soffa imorgon kl 10.", type: "help", time: "10m sedan" },
        { id: 2, user: "Anna K.", text: "Kan låna ut min gräsklippare om någon behöver.", type: "offer", time: "1h sedan" },
        { id: 3, user: "Maja H.", text: "🚶 Går från Stureplan till Södermalm nu.", type: "walk", time: "5m sedan", privacy: "girls" },
        { id: 4, user: "Johan L.", text: "Någon som vill ta en promenad i parken?", type: "help", time: "2h sedan" }
    ];

    // State
    var currentUser = null;
    var currentCreateType = 'help';

    // Fast view switcher
    function show(view) {
        v_login.classList.add('hidden');
        v_feed.classList.add('hidden');
        v_create.classList.add('hidden');
        view.classList.remove('hidden');
    }

    // Render logic - minimal DOM manipulation
    function renderPosts(filter) {
        var html = '';
        var i = 0;
        var len = posts.length;
        for (; i < len; i++) {
            var p = posts[i];
            if (filter && filter !== 'all' && p.type !== filter) continue;

            var typeLabel = '';
            if (p.type === 'help') typeLabel = '🆘 Behöver hjälp';
            else if (p.type === 'offer') typeLabel = '🤝 Erbjuder hjälp';
            else if (p.type === 'walk') typeLabel = '🚶 Vandringskamrat';

            html += '<div class="card post">' +
                '<div class="post-header">' + p.user + '</div>' +
                '<div class="post-content">' + p.text + '</div>' +
                '<div class="post-meta">' + typeLabel + ' • ' + p.time + '</div>' +
                '</div>';
        }
        posts_cont.innerHTML = html;
    }

    // Event handlers
    btn_login.onclick = function () {
        btn_login.innerText = "Verifierar...";
        btn_login.disabled = true;
        setTimeout(function () {
            currentUser = "Medborgare 123";
            show(v_feed);
            nav.classList.remove('hidden');
            renderPosts('all');
        }, 800);
    };

    btn_create.onclick = function () {
        currentCreateType = 'help';
        create_title.innerText = "Skapa inlägg";
        walk_fields.classList.add('hidden');
        privacy_section.classList.add('hidden');
        show(v_create);
    };

    nav_walk.onclick = function () {
        currentCreateType = 'walk';
        create_title.innerText = "Hitta gå-kompis";
        walk_fields.classList.remove('hidden');
        privacy_section.classList.remove('hidden');
        show(v_create);
    };

    nav_home.onclick = function () {
        show(v_feed);
        renderPosts('all');
    };

    btn_cancel.onclick = function () {
        show(v_feed);
    };

    btn_post.onclick = function () {
        var txt = post_text.value.trim();
        var from = walk_from.value.trim();
        var to = walk_to.value.trim();

        if (currentCreateType === 'walk') {
            if (!from || !to) return alert("Ange från och till");
            txt = "🚶 Går från " + from + " till " + to + ". " + txt;
        } else {
            if (!txt) return;
        }

        posts.unshift({
            id: Date.now(),
            user: "Du (Verifierad)",
            text: txt,
            type: currentCreateType,
            time: "Just nu",
            privacy: currentCreateType === 'walk' ? privacy_select.value : 'all'
        });

        // Reset
        post_text.value = '';
        walk_from.value = '';
        walk_to.value = '';
        show(v_feed);
        renderPosts('all');
    };

    // Filter handling using delegation
    d.querySelector('.filter-bar').onclick = function (e) {
        if (e.target.classList.contains('filter-btn')) {
            var btns = d.querySelectorAll('.filter-btn');
            for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
            e.target.classList.add('active');
            renderPosts(e.target.getAttribute('data-filter'));
        }
    };

    // Initialize
    show(v_login);

})();
