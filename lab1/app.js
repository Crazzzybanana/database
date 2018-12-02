let express = require('express');
let bodyParser = require('body-parser');
let multer = require('multer');
let uuidv4 = require('uuid/v4');
const pg = require('pg');

let app = express();
let upload  = multer();
let config = require('./config');

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const connectionString = config.key;

const pool = new pg.Pool({connectionString: connectionString});

const client = new pg.Client({connectionString: connectionString});
client.connect();

app.get('/', async (req, res) => {
    await pool.query('SELECT * FROM public."Accounts"', (error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            res.render('index',{
                r: result.rows
            });
        }
    });
});

app.post('/', upload.any(), async(req, res) =>{
    try {
        let date = new Date();
        const text = 'INSERT INTO public."Accounts"(id, login, password, "createdOn", "signedOn", email) VALUES($1, $2, $3, $4, $5, $6)';
        let values = [uuidv4(), req.body.login, req.body.password, date, date,req.body.email];
        await pool.query(text, values);
        res.redirect('/');
    } catch(err) {
        console.log(err.stack)
    }
});

app.post('/delete', upload.any(), async(req, res) =>{
    const text = `DELETE FROM public."Accounts" WHERE id IN (($1))`
    await pool.query(text, [req.body.id]);
    res.redirect('/');
});

app.post('/update', upload.any(), async(req, res) =>{
    let date = new Date();
    await pool.query('UPDATE public."Accounts" SET email=($1), login=($2), password=($3), "signedOn"=($4) WHERE email=($1)',[req.body.email, req.body.login, req.body.password, date]);
    res.redirect('/');
});

app.get('/characters/:acc_id', async (req, res) => {
    await client.query('SELECT * FROM public."Characters" WHERE ("accountId") IN ($1)', [req.params.acc_id],(error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            res.render('characters',{
                r: result.rows,
                id: req.params.acc_id
            });
        }
    }); 
});

app.post('/characters/:acc_id', upload.any(), async(req, res) =>{
    try {
        const text = 'INSERT INTO public."Characters"(id, "accountId", nickname, level, hp, mp) VALUES($1, $2, $3, $4, $5, $6)';
        let values = [uuidv4(), req.params.acc_id, req.body.nickname, 1, 20, 20];
        await pool.query(text, values);
        res.redirect('/characters/' + req.params.acc_id);
    } catch(err) {
        console.log(err.stack)
    }
});

app.post('/characters/:acc_id/delete', upload.any(), async(req, res) =>{
    const text = `DELETE FROM public."Characters" WHERE (id) IN (($1));`
    await pool.query(text, [req.body.id]);
    res.redirect('/characters/' + req.params.acc_id);
});

app.post('/characters/:acc_id/update', upload.any(), async(req, res) =>{
    await pool.query('SELECT * FROM public."Characters" WHERE (nickname) IN ($1)', [req.body.nickname], (error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            let data = result.rows[0];
            pool.query('UPDATE public."Characters" SET level=($2), hp=($3), mp=($4) WHERE nickname=($1)', [req.body.nickname, data.level+1, data.hp*2, data.mp*2]);
            res.redirect('/characters/' + req.params.acc_id);
        }
    });
});

app.get('/items/:char_id', async (req, res) => {
    await client.query('SELECT * FROM public."Items" WHERE ("characterId") IN ($1)', [req.params.char_id],(error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            res.render('items',{
                r: result.rows,
                id: req.params.char_id
            });
        }
    });
});

app.post('/items/:char_id', upload.any(), async(req, res) =>{
    try {
        const text = 'INSERT INTO public."Items"(id, "characterId", name, count) VALUES($1, $2, $3, $4)';
        let values = [uuidv4(), req.params.char_id, req.body.name, 1];
        await pool.query(text, values);
        res.redirect('/items/' + req.params.char_id);
    } catch(err) {
        console.log(err.stack)
    }
});


app.post('/items/:char_id/delete', upload.any(), async(req, res) =>{
    const text = `DELETE FROM public."Items" WHERE (id) IN (($1));`
    await pool.query(text, [req.body.id]);
    res.redirect('/items/' + req.params.char_id);
});

app.post('/filter', upload.any(), async(req, res) =>{
    console.log(req.body);
    const firstTable = selectTable(req.body.field);
    const secondTable = selectTable(req.body.countField);
    const url = `SELECT * FROM public."${firstTable.table}" INNER JOIN public."${secondTable.table}" ON (public."${firstTable.table}".id) = (public."${secondTable.table}"."accountId")`;
    await pool.query(url,(error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            console.log(result.rows);
        }
    });
});

app.post('/fullText', upload.any(), async(req, res) =>{
    console.log(req.body);
    const table = selectTable(req.body.field);
    const url = `SELECT * FROM public."${table.table}" WHERE to_tsvector($1) @@ ${req.body.textSearch === 'included' ? 'to_tsquery' : '!! to_tsquery'}($2)`;
    await pool.query(url, [req.body.field ,req.body.filterInput],(error, result) => {
        if (error) {
            console.log(error.stack);
        } else {
            console.log(result.rows);
            res.render('filter', {
                r: result.rows,
                l: table.length
            })
        }
    });
});

selectTable = (field) => {
    const Accounts = 'Accounts';
    const Characters = 'Characters';
    const Items = 'Items';
    switch(field){
        case 'login': return {table: Accounts, length: 5};
        case 'password': return {table: Accounts, length: 5};
        case 'email': return {table: Accounts, length: 5};
        case 'nickname': return {table: Characters, length: 4};
        case 'level': return {table: Characters, length: 4};
        case 'hp': return {table: Characters, length: 4};
        case 'mp': return {table: Characters, length: 4};
        case 'name': return {table: Items, length: 2};
        case 'itemcount': return {table: Items, length: 2};
        default: return;
    }
}

app.listen(7698, () => console.log("UP!"));