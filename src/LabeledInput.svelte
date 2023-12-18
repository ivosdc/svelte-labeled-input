<script>
    import {createEventDispatcher} from "svelte";

    export let name = '';
    export let placeholder = '';
    export let value = '';
    export let label = '';
    export let errormessage = '';
    export let validator = (x) => {
        return []
    };
    export let type = 'text';
    export let size = '20';
    export let rows = '2';
    export let min = '';
    export let max = '';

    export let shadowed = false;

    const dispatch = createEventDispatcher();

    let error = '';
    const validate = (event) => {
        if (validator !== undefined && validator !== null) {
            let violations = validator(value);
            if (violations.length === 0) {
                error = "";
                return true;
            }
            if (Array.isArray(violations)) {
                error = violations.map(o => o.message).join(", ");
            } else {
                error = violations;
            }
            customDispatch(event, "error", error);
            return false;
        } else {
            return true;
        }
    }

    function setFocus(e) {
        let elem = document.getElementById(name);
        elem.focus();
    }

    function handleKeyUp(e) {
        customDispatch(e, "keyup", {
            key: e.key
        });
    }

    function dispatchInput(e) {
        validate(e);
        customDispatch(e, 'input', value)
    }

    function customDispatch(event, name, details) {
        if (shadowed) {
            event.target.dispatchEvent(
                new CustomEvent(name, {
                    composed: true,
                    detail: details
                }))
        } else {
            dispatch(name, details);
        }
    }

</script>


<div class="field">
    <span class="error">{errormessage}</span>
    {#if type === "password"}
        <input bind:value={value} id={name} name={name} placeholder={placeholder} size={size}
               on:input={dispatchInput}
               on:keyup={handleKeyUp}
               on:change={(e) => {dispatch('change', value)}}
               on:blur={(e) => {dispatch('blur', value)}}
               on:keypress={(e) => {dispatch('keypress', value)}}
               type="password" tabindex="0"/>
    {:else if type === "area"}
            <textarea id={name} name={name} bind:value={value} placeholder={placeholder} rows={rows} cols={size}
                      on:input={dispatchInput}
                      on:keyup={handleKeyUp}
                      on:change={(e) => {dispatch('change', value)}}
                      on:blur={(e) => {dispatch('blur', value)}}
                      on:keypress={(e) => {dispatch('keypress', value)}}
                      tabindex="0"></textarea>
    {:else if type === "text"}
        <input bind:value={value} id={name} name={name} placeholder={placeholder} size={size}
               on:input={dispatchInput}
               on:keyup={handleKeyUp}
               on:change={(e) => {dispatch('change', value)}}
               on:blur={(e) => {dispatch('blur', value)}}
               on:keypress={(e) => {dispatch('keypress', value)}}
               type="text" tabindex="0"/>
    {:else if type === "number"}
        <input bind:value={value} id={name} name={name} placeholder={placeholder}
               min={min}
               max={max}
               on:input={dispatchInput}
               on:keyup={handleKeyUp}
               on:change={(e) => {dispatch('change', value)}}
               on:blur={(e) => {dispatch('blur', value)}}
               on:keypress={(e) => {dispatch('keypress', value)}}
               type="number" tabindex="0"/>
    {/if}
    <label on:click={setFocus} for={name}>{label}</label>
</div>


<style>

    :root {
        --textarea-border: #e1e1e1;
        --textarea-border-focus: #bfbfbf;
        --font-color: #333333;
        --border-bottom: #999999;
        --border-bottom-hover: #4A849F;
        --font-size: 1em;
    }

  .error {
    width: 100%;
    color: var(--border-bottom);
    font-size: 12px;
    min-height: 14px;
    max-height: 14px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .field {
    display: flex;
    flex-flow: column-reverse;
  }

  label, input, textarea {
    transition: all 0.3s;
    touch-action: manipulation;
    width: inherit;
  }

  label {
    position: relative;
    font-size: 0.8em;
    top: -1px;
    color: var(--border-bottom);
    max-width: 0;
    height: 21px;
    white-space: nowrap;
  }

  input, textarea {
    border: 0;
    border-bottom: 2px solid var(--border-bottom);
    font-family: inherit;
    font-weight: 200;
    font-size: var(--font-size);
    appearance: none;
    border-radius: 0.3em;
    cursor: text;
    color: var(--font-color);
    padding: 0 0.5em 2px 0.5em;
  }

  textarea {
    border-top: 1px solid var(--textarea-border);
    border-right: 1px solid var(--textarea-border);
    border-bottom: 2px solid var(--border-bottom);
    padding: 0.3em 0.5em;
    margin-top: -4px;
  }

  textarea:focus {
    border: 1px solid var(--textarea-border-focus);
    outline: 0;
    border-bottom: 2px solid var(--border-bottom-hover);
  }


  input:focus {
    outline: 0;
    border-bottom: 2px solid var(--border-bottom-hover);
  }

  input:placeholder-shown + label, textarea:placeholder-shown + label {
    cursor: text;
    max-width: 0;
    white-space: nowrap;
    overflow: unset;
    text-overflow: ellipsis;
    transform-origin: left top;
    transform: translate(0, 1.5em) scale(1.3);
  }

  ::placeholder {
    opacity: 0;
    transition: inherit;
  }


  input:focus::placeholder, textarea:focus::placeholder {
    opacity: 0.5;
  }

  input:not(:placeholder-shown) + label,
  input:focus + label {
    transform: translate(0, -3px) scale(1.1);
    cursor: pointer;
  }

  textarea:not(:placeholder-shown) + label,
  textarea:focus + label {
    transform: translate(0, -3px) scale(1.1);
    cursor: pointer;
  }
</style>
