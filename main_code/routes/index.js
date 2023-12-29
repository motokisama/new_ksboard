const express = require('express');
const router = express.Router();

const crypto = require('crypto');

const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./database.sqlite3');

const key = 'ks2024';

/* GET home page. */
router.get('/', function (req, res, next) {
    if (req.session.username !== undefined) {
        db.serialize(() => {
            db.all('select * from topics', (err, rows) => {
                if (!err) {
                    let data = {title: 'hello', user_name: req.session.username, content: rows};
                    res.render('index', data);
                } else {
                    console.log(err);
                }
            });
        });
    } else {
        res.render('login', {error: false, err_msg: ''});
    }
});

router.get('/logout', function (req, res, next) {
    req.session.destroy();
    res.redirect('/');
});

router.get('/post', function (req, res, next) {
    if (req.session.username !== undefined) {
        res.render('post_question');
    } else {
        res.redirect('/');
    }
});

router.get('/questions/post',function(req,res,next) {
    if (req.session.username !== undefined && req.session.current_id) {
        res.render('post_response.ejs');
    } else {
        res.redirect('/');
    }
});

router.get('/questions', async function (req, res, next) {
    try {
        let id = req.query.id;
        let data = {question: null, responses: null,question_id: id};
        req.session.current_id = id;

        await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM "${id}"`, (err, rows) => {
                if (err) reject(err);
                data.responses = rows;
                resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM topics WHERE topic_id = ?`, id, (err, row) => {
                if (err) reject(err);
                data.question = row;
                resolve();
            });
        });

        res.render('question',data);
    } catch (err) {
        console.error(err);
        res.render('/');
    }
});

router.post('/', function (req, res, next) {
    let name = req.body['name'];
    let pass = req.body['pass'];
    console.log(name);
    console.log(pass);
    if(name !== undefined && pass === key){
        req.session.username = name;
        res.redirect('/');
    }else if(name !== undefined && pass !== key){
        res.render('login', {error: true, err_msg: 'キーが間違っています。'});
    }else{
        res.render('login',{error: true, err_msg: '名前を入力してください'});
    }
});

router.post('/post/submit', function (req, res, next) {
    let question_title = req.body['question_title'];
    let question_content = req.body['question_content'];
    let tableLength = 0;

    db.serialize(() => {
        let string_id = generateRandomId(20); // Generate the initial random ID
        let isDuplicate = false;

        db.each('SELECT * FROM topics', (err, row) => {
            if (!err && row.topic_id === string_id) {
                isDuplicate = true; // Set the flag if a duplicate ID is found
            }
        }, () => {
            if (isDuplicate) {
                // Generate a new random ID until a unique one is found
                do {
                    string_id = generateRandomId(20);
                } while (isDuplicate);
            }
            db.run('insert into topics ("topic_title","questioner","question_content","topic_id") ' +
                'values (?,?,?,?)', question_title, req.session.username, question_content, string_id);
            db.run(`CREATE TABLE "${string_id}" (
                \t"id"\tINTEGER NOT NULL UNIQUE,
                \t"response_name"\tTEXT NOT NULL,
                \t"response_content"\tTEXT NOT NULL,
                \tPRIMARY KEY("id" AUTOINCREMENT)
                );`);
            // Use the unique ID for further processing or database operations
            // ...
        });
    });
    res.redirect('/');
});

router.post('/question/post/submit', function (req, res, next) {
    if(req.session.username !== undefined && req.session.current_id){
        let response_content = req.body['response_content'];
        let name = req.session.username;
        let id = req.session.current_id;
        db.serialize(() => {
            db.run(`insert into "${id}" ("response_name","response_content") values (?,?)`,name,response_content);
        });
        res.redirect(`/questions?id=${id}`);
    }else{
        res.redirect('/');
    }
});


function generateRandomId(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = router;
