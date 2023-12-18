# svelte-labeled-input
- Web-component: `<labeled-input></labeled-input>`
- or Svelte-component: `import LabeledInput from 'svelte-labeled-input'`

css3 layout label transition input text field validates errormessage password style

![GIF from the labeled input field](./readme-assets/svelte-labeled-input.gif)

[Try out live example:](https://ivosdc.github.io/svelte-labeled-input/ "GeneralCrudTable Example")

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/svelte-labeled-input)

## Install

```
npm install svelte-labeled-input
```

[![Donate](https://github.com/ivosdc/svelte-generic-crud-table/raw/master/assets/donate.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7V5M288MUT7GE&source=url)


# Usage
Import the component.
```
    import LabeledInput from 'svelte-labeled-input'
```

Use the component.
```
    <LabeledInput id="prename"
                  placeholder="Your prename"
                  label="Prename:"
                  bind:value={prename}/>
                  
    <LabeledInput id="interval"
                placeholder="Interval in days"
                label="Interval :"
                type="number"
                min="1"
                max="21"
                on:blur={setInterval}
                on:keypress={handleKeys}
                bind:value={daysInterval} />
                
    <LabeledInput id="description"
                placeholder="Description"
                label="Description:"
                validator={descriptionValidator}
                errormessage={errormessage}
                type="area"
                size="50"
                rows="4"
                bind:value={description} />
```

The styled and labeled input "html"-element offers the optional parameters:
```
    export let name;        // id and name of the component in DOM
    export let placeholder; // Placeholder for no input value
    export let value;       // Value of the input field. 
    export let label;       // Label of the input field
    export let type         // default "text". ["text", "area", "number", "password"]
    export let validator;   // text validation function. Returns [true || false]. Dispatches an Error-Event on `false`
    export let errormessage;// Errormessage for validation error
    
    min, max for inpt{type=number}
    
    size for inpt{type=text}
    
    size, rows for textarea
```

Events:
```
    on:input={...}    // checks the input with the `validator` function and fires input-event with the `value`
    on:keyup={...}    // fires input-event with the `key`
    on:change={...}   // fires change-event with the `value`
    on:blur={...}     // fires blur-event with the `value`
    on:keypress={...} // fires keypress-event with the `value`
```

### Web-Component
```
<custom-element-demo>
<template>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>Generic Crud Table</title>
    <link rel='icon' type='image/png' href='favicon.png'>
    <link rel='stylesheet' href='https://ivosdc.github.io/svelte-labeled-input/build/labeled-input.css'>
    <script defer src='https://ivosdc.github.io/svelte-labeled-input/build/labeled-input.js'></script>
</head>
<body>
<hr>
<labeled-input name="prename"
               placeholder="Your prename"
               label="Prename:"
               value=""></labeled-input>
<labeled-input name="fullname"
               placeholder="Your family name"
               label="Name:"
               value=""></labeled-input><hr>
               
<labeled-input name="interval"
                placeholder="Interval in days"
                label="Interval :"
                type="number"
                min="1"
                max="21"
                value="5"></labeled-input>
                
<labeled-input name="description"
                placeholder="Description"
                label="Description:"
                type="area"
                size="50"
                rows="4"
                value="I'm a description."></labeled-input>
</body>
<script>
</script>
</template>
</custom-element-demo>
```

```html
<labeled-input></labeled-input>
```


###  Svelte-Component:
```
<script>
    import LabeledInput from 'svelte-labeled-input'

    let prename;
    let fullname;

    // Example validator: Prename can only have 3 chars
    const prenameValidator = (value) => {
        return (value.length > 3) ? false : true;
    }
</script>

<main>
    <hr>
    <LabeledInput name="prename"
                  errormessage="Prename can only have 3 characters."
                  validator={prenameValidator(prename)}
                  placeholder="Your prename"
                  label="Prename:"
                  bind:value={prename}/>
    <LabeledInput name="fullname"
                  placeholder="Your name"
                  label="Family name:"
                  bind:value={fullname}/>
    <LabeledInput name="password"
                  placeholder="Enter password"
                  label="Password:"
                  type="password"
                  bind:value={password}/>
</main>

```
