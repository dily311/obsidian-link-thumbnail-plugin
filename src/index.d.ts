// 전역 윈도우 객체에 localforage가 있음을 선언
declare global {
    interface Window {
        localforage?: typeof import("localforage");
    }
}

export {};