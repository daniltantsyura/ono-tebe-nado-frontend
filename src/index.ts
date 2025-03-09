import './scss/styles.scss';

import {AuctionAPI} from "./components/AuctionAPI";
import {API_URL, CDN_URL} from "./utils/constants";
import {EventEmitter} from "./components/base/events";
import { Model } from './components/base/Model';
import { Component } from './components/base/Component';
import { createElement, ensureElement } from './utils/utils';
import { extend, result } from 'lodash';
import { dayjs } from './utils/utils';
import _ from 'lodash';
import { Modal } from './components/common/Modal';

const events = new EventEmitter();
const api = new AuctionAPI(CDN_URL, API_URL);

// Чтобы мониторить все события, для отладки
events.onAll(({ eventName, data }) => {
    console.log(eventName, data);
})

type ItemStatus = 'wait' | 'active' | 'closed';

interface IItem {
    id: string;
    title: string;
    about: string;
    status: ItemStatus;
    datetime: string;
    image: string;
}

interface ICatalog {
    items: IItem[];
}

type ScreenElement = HTMLElement | HTMLElement[] | boolean;

abstract class ScreenState {
    content?: ScreenElement;
    modalContent?: ScreenElement;

    mount() {};
    unmount() {};
}

class Screen {
    protected content: HTMLElement;
    protected itemContainer: HTMLElement;
    protected modal: Modal;

    protected prevScreen: ScreenState;

    constructor(modal: Modal) {
        this.content = ensureElement('main');
        this.modal = modal;
    }

    protected setElement(element: HTMLElement, children?: ScreenElement) {
        if (children instanceof HTMLElement) element.replaceChildren(children);
        if (children instanceof Array) element.replaceChildren(...children);
    }

    setState(state: ScreenState) {
        if (this.prevScreen) this.prevScreen.unmount();
        if(state.modalContent instanceof HTMLElement) this.modal.content = state.modalContent;

        this.setElement(this.content, state.content);
        state.mount();

        this.prevScreen = state;
    }
}

class MainScreen extends ScreenState {
    hero: HTMLElement = ensureElement('.hero');
    catalog: HTMLElement;
    about: HTMLElement = ensureElement('.about');
    content: HTMLElement[];

    constructor(catalog: HTMLElement) {
        super();
        this.catalog = catalog;
        this.content = [this.hero, this.catalog, this.about];
    }
}

class PreviewModal extends ScreenState {
    content: ScreenElement = false;
    modalContent: HTMLElement;

    constructor(protected itemConstructor: IItemConstructor) {
        super();
    }

    set item(itemData: IItem) {
        
    }
}

class Catalog extends Model<ICatalog> implements ICatalog {
    items: IItem[];

    setItems(items: IItem[]) {
        this.items = items.map(item => _.pick(item, [
            'id', 
            'title', 
            'about', 
            'datetime', 
            'status',
            'image'
        ]));
        this.emitChanges('catalog.items:changed', {
            items: this.items
        })
    }
}

interface IItemConstructor {
    new (): Component<IItem>;
}

class CatalogView extends Component<ICatalog> {
    protected itemsContainer: HTMLElement;

    constructor(protected Item: IItemConstructor) {
        super(ensureElement('.catalog'));
        this.itemsContainer = ensureElement('.catalog__items', this.container);
    }

    set items(items: IItem[]) {
        this.itemsContainer.replaceChildren(...items.map(item => {
            const itemView = new this.Item();
            return itemView.render(item);
        }));
    }
}

class CatalogItemView extends Component<IItem> {
    id: string;
    date: string;
    
    constructor() {
        const template = document.querySelector('#card') as HTMLTemplateElement;
        const templateContent = template.content;
        const element: HTMLElement = templateContent.querySelector('.catalog_item.card').cloneNode(true) as HTMLElement;
        super(element);
        this.container.addEventListener('click', this.onClick);
    }

    protected onClick = () => {
        alert(`Click on ${this.id}`);
    }

    set title(title: string) {
        ensureElement('.card__title', this.container).textContent = title;
    }

    set about(description: string) {
        ensureElement('.card__description', this.container).textContent = description;
    }

    set status(status: ItemStatus) {
        const statusClass = 'card__status'
        const statusElement = ensureElement(`.${statusClass}`, this.container);
        switch (status) {
            case 'wait':
                statusElement.textContent = `Откроется ${this.date}`;
            break;
            case 'active':
                statusElement.textContent = `Открыто до ${this.date}`;
                this.modifyStatus(statusElement, statusClass, status);
            break;
            case 'closed':
                statusElement.textContent = `Закрыто ${this.date}`;
                this.modifyStatus(statusElement, statusClass, status);
        }
    }

    set datetime(value: string) {
        this.date = dayjs(value).format('D MMMM HH:mm');
    }

    set image(url: string) {
        const imageElement: HTMLImageElement = ensureElement('.card__image', this.container) as HTMLImageElement;
        imageElement.src = url;
    }

    protected modifyStatus(element: HTMLElement, className: string, status: ItemStatus) {
        this.toggleClass(element, `${className}_${status}`);
    }
}

const catalog = new Catalog({
    items: []
}, events);
const catalogView = new CatalogView(CatalogItemView);
const modal = new Modal(ensureElement('#modal-container'), events);

events.on('catalog.items:changed', () => {
    catalogView.render(catalog);
});

const screen = new Screen(modal);
const mainScreen = new MainScreen(catalogView.render(catalog));

screen.setState(mainScreen);

api.getLotList()
    .then(result => {
        catalog.setItems(result);
    })
    .catch(err => {
        console.error(err);
    });

// interface ICounter {
//     amount: number;
// }

// class Counter extends Component<ICounter> {
//     protected _counter:HTMLElement;
//     protected _increment: HTMLButtonElement;
//     protected _decrement: HTMLButtonElement;

//     constructor(container: HTMLElement) {
//         super(container);

//         this._counter = createElement<HTMLElement>('div');
//         this._increment = createElement<HTMLButtonElement>('button', {
//             className: 'button button_outline',
//             textContent: '+'
//         });
//         this._decrement = createElement<HTMLButtonElement>('button', {
//             className: 'button button_outline',
//             textContent: '-'
//         });

//         this.container.append(this._counter, this._increment, this._decrement);
//         this._increment.addEventListener('click', this.onClick(1));
//         this._decrement.addEventListener('click', this.onClick(-1));
//     }

//     protected onClick = (change: number) => () => {
//         console.log('change: ', change);
//         this.amount += change;
//     }

//     set amount(value: number) {
//         this.setText(this._counter, value);
//     }

//     get amount() {
//         return Number(this._counter.textContent);
//     }
// }

// const root = ensureElement<HTMLElement>('main .catalog__items');
// const counter = new Counter(root);
// counter.render({
//     amount: 5
// });

// Все шаблоны


// Модель данных приложения


// Глобальные контейнеры


// Переиспользуемые части интерфейса


// Дальше идет бизнес-логика
// Поймали событие, сделали что нужно


// Получаем лоты с сервера
// api.getLotList()
//     .then(result => {
//         // вместо лога поместите данные в модель
//         console.log(result);
//     })
//     .catch(err => {
//         console.error(err);
//     });


