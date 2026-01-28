(function () {
    'use strict';

    // Cache DOM nodes for speed
    var d = document;
    var v_login = d.getElementById('login-view');
    var v_feed = d.getElementById('feed-view');
    var v_create = d.getElementById('create-view');
    var nav = d.getElementById('n');
    var posts_cont = d.getElementById('posts-container');

    var btn_login = d.getElementById('btn-login');
    var btn_create = d.getElementById('btn-create');
    var btn_cancel = d.getElementById('btn-cancel');
    var btn_post = d.getElementById('btn-post');
    var post_text = d.getElementById('post-text');

    // Data - using simple arrays for memory efficiency
    var posts = [
        { id: 1, user: "Erik S.", text: "Behöver hjälp med att bära en soffa imorgon kl 10.", type: "help", time: "10m sedan" },
        { id: 2, user: "Anna K.", text: "Kan låna ut min gräsklippare om någon behöver.", type: "offer", time: "1h sedan" },
        { id: 3, user: "Johan L.", text: "Någon som vill ta en promenad i parken?", type: "help", time: "2h sedan" }
    ];

    // State
    var currentUser = null;

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

            html += '<div class="card post">' +
                '<div class="post-header">' + p.user + '</div>' +
                '<div class="post-content">' + p.text + '</div>' +
                '<div class="post-meta">' + (p.type === 'help' ? '🆘 Behöver hjälp' : '🤝 Erbjuder hjälp') + ' • ' + p.time + '</div>' +
                '</div>';
        }
        posts_cont.innerHTML = html;
    }

    // Event handlers
    btn_login.onclick = function () {
        // Mock BankID login
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
        show(v_create);
    };

    btn_cancel.onclick = function () {
        show(v_feed);
    };

    btn_post.onclick = function () {
        var txt = post_text.value.trim();
        if (!txt) return;

        posts.unshift({
            id: Date.now(),
            user: "Du (Verifierad)",
            text: txt,
            type: "help",
            time: "Just nu"
        });

        post_text.value = '';
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
