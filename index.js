
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const hbs = require('hbs');

hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

const port = 3000;
const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'hbs');


app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));


const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.log('Database gagal:', err.message);
    } else {
        console.log('Database berhasil terhubung!');
    }
});


db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
`);
db.run(`
    CREATE TABLE IF NOT EXISTS buku (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judulbuku TEXT NOT NULL,
        penulis TEXT NOT NULL,
        kategori TEXT NOT NULL,
        tahunterbit INTEGER,
        isbn TEXT UNIQUE
    )
`, (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('Tabel buku berhasil dibuat');
    }
});

function userlogin(req, res, next) {
    if (req.session.username) {
        next();
    } else {
        return res.send('hayoloh');
    }
}

//tambahusers

app.get('/tambahusers', (req, res) => {
    return res.render('tambahusers');
});


app.post('/tambahusers', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.send('Username dan password wajib diisi!');
    }

    if (password.length < 6) {
        return res.send('Password minimal 6 karakter!');
    }

    try {
        
        const hashPassword = await bcrypt.hash(password, 10);

        
        db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username.trim(), hashPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.send('Username sudah digunakan!');
                    }

                    return res.send('Gagal membuat akun!');
                }

                return res.send('Akun berhasil dibuat! <a href="/login">Silakan login</a>');
            }
        );

    } catch (err) {
        return res.send('Terjadi kesalahan!');
    }
});

// login

app.get('/login', (req, res) => {
    return res.render('login');
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.send('Username dan password wajib diisi!');
    }


    db.get(
        'SELECT * FROM users WHERE username = ?',
        [username.trim()],
        async (err, data) => {
            if (err) {
                return res.send('Kesalahan database!');
            }

            if (!data) {
                return res.send('Username tidak ditemukan!');
            }

            try {
                
                const cocok = await bcrypt.compare(
                    password,
                    data.password
                );

                if (cocok) {
                    req.session.username = data.username;
                    return res.redirect('/haruslogin');
                }

                return res.send('Password salah!');

            } catch (err) {
                return res.send('Terjadi kesalahan!');
            }
        }
    );
});



app.get('/haruslogin', userlogin, (req, res) => {
    console.log(req.session.username);
    return res.send('Berhasil login ygy! Selamat datang ' + req.session.username);
});


app.get('/public', (req, res) => {
    console.log(req.session.username);
    return res.send('anda login tanpa login');
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Gagal logout!');
        }

        return res.redirect('/login');
    });
});

//users

app.get('/users', (req, res) => {
    db.all('SELECT * FROM users', [], (err, users) => {
        if (err) {
            return res.send('Gagal mengambil data users');
        }

        res.render('users', { users });
    });
});


app.post('/hapususers/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        'DELETE FROM users WHERE id = ?',
        [id],
        (err) => {
            if (err) {
                return res.send('Gagal menghapus user');
            }

            res.redirect('/users');
        }
    );
});


app.get('/editusers/:id', (req, res) => {
    const id = req.params.id;

    db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, user) => {
            if (err || !user) {
                return res.send('User tidak ditemukan');
            }

            res.render('editusers', { user });
        }
    );
});


app.post('/editusers/:id', async (req, res) => {
    const id = req.params.id;
    const { username, password } = req.body;

    try {
        const hashPassword = await bcrypt.hash(password, 10);

        db.run(
            'UPDATE users SET username = ?, password = ? WHERE id = ?',
            [username, hashPassword, id],
            (err) => {
                if (err) {
                    return res.send('Gagal mengedit user');
                }

                res.redirect('/users');
            }
        );
    } catch (err) {
        res.send('Terjadi kesalahan');
    }
});

app.get('/tambahbuku', (req, res) => {
    res.render('tambahbuku');
});

app.post('/tambahbuku', (req, res) => {

    const { judulbuku, penulis, kategori, tahunterbit, isbn } = req.body;

    db.run(
        `INSERT INTO buku
        (judulbuku, penulis, kategori, tahunterbit, isbn)
        VALUES (?, ?, ?, ?, ?)`,
        [judulbuku, penulis, kategori, tahunterbit, isbn],
        (err) => {

            if (err) {
                return res.send('Gagal menyimpan buku: ' + err.message);
            }

            res.redirect('/buku');
        }
    );
});

app.get('/buku', (req, res) => {

    db.all('SELECT * FROM buku', [], (err, rows) => {

        if (err) {
            return res.send('Gagal mengambil data buku');
        }

        res.render('buku', { buku: rows });

    });

});


app.get('/editbuku/:id', (req, res) => {

    const id = req.params.id;

    db.get(
        'SELECT * FROM buku WHERE id = ?',
        [id],
        (err, buku) => {

            if (err) {
                return res.send('Gagal mengambil data buku');
            }

            if (!buku) {
                return res.send('Buku tidak ditemukan');
            }

            res.render('editbuku', { buku });

        }
    );

});


app.post('/editbuku/:id', (req, res) => {

    const id = req.params.id;

    const {
        judulbuku,
        penulis,
        tahunterbit,
        kategori,
        isbn
    } = req.body;

    db.run(
        `UPDATE buku SET
            judulbuku = ?,
            penulis = ?,
            tahunterbit = ?,
            kategori = ?,
            isbn = ?
        WHERE id = ?`,

        [
            judulbuku,
            penulis,
            tahunterbit,
            kategori,
            isbn,
            id
        ],

        (err) => {

            if (err) {
                return res.send('Gagal mengubah buku: ' + err.message);
            }

            res.redirect('/buku');

        }
    );

});


app.post('/hapusbuku/:id', (req, res) => {

    const id = req.params.id;

    db.run(
        'DELETE FROM buku WHERE id = ?',
        [id],
        (err) => {

            if (err) {
                return res.send('Gagal menghapus buku: ' + err.message);
            }

            res.redirect('/buku');

        }
    );

});



app.listen(port, () => {
    console.log(`Server: http://localhost:${port}/login`);
});
