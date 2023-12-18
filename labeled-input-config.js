//config labeled-input


let prename = document.getElementById('prename');
let fullname = document.getElementById('fullname');
let interval = document.getElementById('interval');
let description = document.getElementById('description');


prename.setAttribute('shadowed', 'true');

prename.addEventListener('input', (e) => {
    console.log('input');
});
